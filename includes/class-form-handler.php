<?php
/**
 * Класс для обработки формы в рамках плагина
 */

if (!defined('ABSPATH')) {
    exit;
}

class AstartaFormHandler {
    
    private $nonce_action = 'astarta_contact_form';
    private $admin_email;
    
    public function __construct() {
        $this->admin_email = get_option('admin_email');
        
        // Добавляем AJAX обработчики
        add_action('wp_ajax_submit_contact_form', array($this, 'handle_form_submission'));
        add_action('wp_ajax_nopriv_submit_contact_form', array($this, 'handle_form_submission'));
        
        // Добавляем shortcode для формы
        add_shortcode('astarta_contact_form', array($this, 'render_form'));
        
        // Добавляем скрипты и стили
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        
        // Добавляем обработчик для прямых POST запросов
        add_action('init', array($this, 'handle_direct_submission'));
    }
    
    /**
     * Подключение скриптов и стилей
     */
    public function enqueue_scripts() {
        wp_enqueue_script('jquery');
        
        // Добавляем переменные для AJAX
        wp_add_inline_script('jquery', '
            window.astarta_ajax = {
                ajax_url: "' . admin_url('admin-ajax.php') . '",
                nonce: "' . wp_create_nonce($this->nonce_action) . '"
            };
        ');
    }
    
    /**
     * Обработка прямых POST запросов (не AJAX)
     */
    public function handle_direct_submission() {
        if ($_SERVER['REQUEST_METHOD'] === 'POST' && 
            isset($_POST['action']) && 
            $_POST['action'] === 'submit_contact_form' &&
            !defined('DOING_AJAX')) {
            
            $this->handle_form_submission();
        }
    }
    
    /**
     * Валидация данных формы
     */
    private function validate_form_data($data) {
        $errors = array();
        
        // Проверка имени
        if (empty($data['firstName']) || strlen(trim($data['firstName'])) < 2) {
            $errors['firstName'] = 'Имя должно содержать минимум 2 символа';
        }
        
        // Проверка фамилии
        if (empty($data['lastName']) || strlen(trim($data['lastName'])) < 2) {
            $errors['lastName'] = 'Фамилия должна содержать минимум 2 символа';
        }
        
        // Проверка email
        if (empty($data['email']) || !is_email($data['email'])) {
            $errors['email'] = 'Введите корректный email адрес';
        }
        
        // Проверка телефона
        if (empty($data['phone']) || !preg_match('/^[\+\d\s\-\(\)]{10,}$/', $data['phone'])) {
            $errors['phone'] = 'Введите корректный номер телефона';
        }
        
        return $errors;
    }
    
    /**
     * Санитизация данных
     */
    private function sanitize_form_data($data) {
        return array(
            'firstName' => sanitize_text_field($data['firstName']),
            'lastName' => sanitize_text_field($data['lastName']),
            'email' => sanitize_email($data['email']),
            'phone' => sanitize_text_field($data['phone'])
        );
    }
    
    /**
     * Сохранение заявки в базу данных
     */
    private function save_to_database($data) {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        $result = $wpdb->insert(
            $table_name,
            array(
                'first_name' => $data['firstName'],
                'last_name' => $data['lastName'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'ip_address' => $this->get_client_ip(),
                'user_agent' => sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? ''),
                'created_at' => current_time('mysql'),
                'status' => 'new'
            ),
            array('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );
        
        return $result !== false ? $wpdb->insert_id : false;
    }
    
    /**
     * Получение IP адреса клиента
     */
    private function get_client_ip() {
        $ip_keys = array('HTTP_CF_CONNECTING_IP', 'HTTP_CLIENT_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR');
        
        foreach ($ip_keys as $key) {
            if (array_key_exists($key, $_SERVER) === true) {
                $ip = $_SERVER[$key];
                if (strpos($ip, ',') !== false) {
                    $ip = explode(',', $ip)[0];
                }
                $ip = trim($ip);
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }
        
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
    
    /**
     * Отправка email уведомления
     */
    private function send_email_notification($data, $contact_id) {
        $subject = 'Новая заявка с сайта Astarta Capital';
        
        $message = "Получена новая заявка с сайта:\n\n";
        $message .= "ID заявки: {$contact_id}\n";
        $message .= "Имя: {$data['firstName']}\n";
        $message .= "Фамилия: {$data['lastName']}\n";
        $message .= "Email: {$data['email']}\n";
        $message .= "Телефон: {$data['phone']}\n";
        $message .= "IP адрес: " . $this->get_client_ip() . "\n";
        $message .= "Дата: " . current_time('mysql') . "\n";
        $message .= "User Agent: " . sanitize_text_field($_SERVER['HTTP_USER_AGENT'] ?? '') . "\n";
        
        $headers = array(
            'Content-Type: text/plain; charset=UTF-8',
            'From: ' . get_bloginfo('name') . ' <' . $this->admin_email . '>',
            'Reply-To: ' . $data['firstName'] . ' ' . $data['lastName'] . ' <' . $data['email'] . '>'
        );
        
        return wp_mail($this->admin_email, $subject, $message, $headers);
    }
    
    /**
     * Отправка подтверждения клиенту
     */
    private function send_client_confirmation($data) {
        $subject = 'Спасибо за обращение - Astarta Capital';
        
        $message = "Здравствуйте, {$data['firstName']}!\n\n";
        $message .= "Спасибо за ваш интерес к Astarta Capital.\n\n";
        $message .= "Мы получили вашу заявку и свяжемся с вами в ближайшее время для обсуждения возможностей партнерства.\n\n";
        $message .= "Ваши данные:\n";
        $message .= "Имя: {$data['firstName']} {$data['lastName']}\n";
        $message .= "Email: {$data['email']}\n";
        $message .= "Телефон: {$data['phone']}\n\n";
        $message .= "С уважением,\n";
        $message .= "Команда Astarta Capital\n\n";
        $message .= "---\n";
        $message .= "Это автоматическое сообщение, пожалуйста, не отвечайте на него.";
        
        $headers = array(
            'Content-Type: text/plain; charset=UTF-8',
            'From: Astarta Capital <' . $this->admin_email . '>'
        );
        
        return wp_mail($data['email'], $subject, $message, $headers);
    }
    
    /**
     * Основной обработчик формы
     */
    public function handle_form_submission() {
        // Проверка nonce для AJAX запросов
        if (defined('DOING_AJAX') && DOING_AJAX) {
            if (!wp_verify_nonce($_POST['nonce'] ?? '', $this->nonce_action)) {
                wp_send_json_error(array('message' => 'Ошибка безопасности. Обновите страницу и попробуйте снова.'));
            }
        }
        
        // Проверка метода запроса
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            $this->send_error_response('Неверный метод запроса.');
            return;
        }
        
        // Получение и санитизация данных
        $form_data = array(
            'firstName' => $_POST['firstName'] ?? '',
            'lastName' => $_POST['lastName'] ?? '',
            'email' => $_POST['email'] ?? '',
            'phone' => $_POST['phone'] ?? ''
        );
        
        $form_data = $this->sanitize_form_data($form_data);
        
        // Валидация
        $errors = $this->validate_form_data($form_data);
        if (!empty($errors)) {
            $this->send_error_response('Пожалуйста, исправьте ошибки в форме.', $errors);
            return;
        }
        
        // Проверка на дубликаты (по email)
        global $wpdb;
        $table_name = $wpdb->prefix . 'astarta_contacts';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_name WHERE email = %s AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
            $form_data['email']
        ));
        
        if ($existing > 0) {
            $this->send_error_response('Заявка с этим email уже была отправлена в течение последнего часа.');
            return;
        }
        
        // Сохранение в базу данных
        $contact_id = $this->save_to_database($form_data);
        if (!$contact_id) {
            $this->send_error_response('Ошибка при сохранении данных. Попробуйте позже.');
            return;
        }
        
        // Отправка уведомлений
        $admin_email_sent = $this->send_email_notification($form_data, $contact_id);
        $client_email_sent = $this->send_client_confirmation($form_data);
        
        // Логирование
        error_log("Astarta Contact Form: New submission ID {$contact_id} from {$form_data['email']}");
        
        // Успешный ответ
        $this->send_success_response(array(
            'message' => 'Спасибо за вашу заявку! Мы свяжемся с вами в ближайшее время.',
            'contact_id' => $contact_id,
            'email_notifications' => array(
                'admin' => $admin_email_sent,
                'client' => $client_email_sent
            )
        ));
    }
    
    /**
     * Отправка ответа об ошибке
     */
    private function send_error_response($message, $errors = null) {
        $response = array('message' => $message);
        if ($errors) {
            $response['errors'] = $errors;
        }
        
        if (defined('DOING_AJAX') && DOING_AJAX) {
            wp_send_json_error($response);
        } else {
            // Для не-AJAX запросов
            header('Content-Type: application/json');
            echo json_encode(array('success' => false, 'data' => $response));
            exit;
        }
    }
    
    /**
     * Отправка успешного ответа
     */
    private function send_success_response($data) {
        if (defined('DOING_AJAX') && DOING_AJAX) {
            wp_send_json_success($data);
        } else {
            // Для не-AJAX запросов
            header('Content-Type: application/json');
            echo json_encode(array('success' => true, 'data' => $data));
            exit;
        }
    }
    
    /**
     * Рендер формы (shortcode)
     */
    public function render_form($atts = array()) {
        $atts = shortcode_atts(array(
            'class' => 'astarta-contact-form'
        ), $atts);
        
        ob_start();
        ?>
        <div class="<?php echo esc_attr($atts['class']); ?>">
            <form id="astarta-contact-form" method="post">
                <input type="hidden" name="action" value="submit_contact_form">
                <?php if (function_exists('wp_nonce_field')): ?>
                    <?php wp_nonce_field($this->nonce_action, 'nonce'); ?>
                <?php endif; ?>
                
                <div class="form-group">
                    <input type="text" name="firstName" placeholder="First Name" required autocomplete="given-name">
                    <span class="error-message" data-field="firstName"></span>
                </div>
                
                <div class="form-group">
                    <input type="text" name="lastName" placeholder="Last Name" required autocomplete="family-name">
                    <span class="error-message" data-field="lastName"></span>
                </div>
                
                <div class="form-group">
                    <input type="tel" name="phone" placeholder="Phone Number" required autocomplete="tel">
                    <span class="error-message" data-field="phone"></span>
                </div>
                
                <div class="form-group">
                    <input type="email" name="email" placeholder="Email Address" required autocomplete="email">
                    <span class="error-message" data-field="email"></span>
                </div>
                
                <button type="submit" class="btn btn_secondary">
                    <span class="btn-text">Send</span>
                    <span class="btn-loader" style="display: none;">Отправка...</span>
                </button>
                
                <div class="form-messages">
                    <div class="success-message" style="display: none;"></div>
                    <div class="error-message" style="display: none;"></div>
                </div>
            </form>
        </div>
        <?php
        return ob_get_clean();
    }
}
?>