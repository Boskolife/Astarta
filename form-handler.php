<?php
/**
 * WordPress Form Handler для Astarta Capital
 * Обработчик формы обратной связи
 */

// Подключаем WordPress
if (!defined('ABSPATH')) {
    // Если файл вызывается напрямую, подключаем WordPress
    $wp_load_path = '';
    
    // Пытаемся найти wp-load.php
    $dir = dirname(__FILE__);
    while ($dir !== '/' && !file_exists($dir . '/wp-load.php')) {
        $dir = dirname($dir);
    }
    
    if (file_exists($dir . '/wp-load.php')) {
        require_once($dir . '/wp-load.php');
    } else {
        // Если не найден, попробуем стандартные пути
        $possible_paths = [
            '../wp-load.php',
            '../../wp-load.php',
            '../../../wp-load.php',
            '../../../../wp-load.php',
            '/wp-load.php'
        ];
        
        foreach ($possible_paths as $path) {
            if (file_exists(__DIR__ . '/' . $path)) {
                require_once(__DIR__ . '/' . $path);
                break;
            }
        }
    }
}

// Проверяем, что WordPress загружен
if (!function_exists('wp_mail')) {
    wp_die('WordPress не загружен. Проверьте путь к wp-load.php');
}

/**
 * Класс для обработки формы
 */
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
    }
    
    /**
     * Подключение скриптов и стилей
     */
    public function enqueue_scripts() {
        wp_enqueue_script('jquery');
        wp_localize_script('jquery', 'astarta_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce($this->nonce_action)
        ));
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
        
        // Создаем таблицу если её нет
        $this->create_contacts_table();
        
        $result = $wpdb->insert(
            $table_name,
            array(
                'first_name' => $data['firstName'],
                'last_name' => $data['lastName'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'ip_address' => $this->get_client_ip(),
                'user_agent' => sanitize_text_field($_SERVER['HTTP_USER_AGENT']),
                'created_at' => current_time('mysql'),
                'status' => 'new'
            ),
            array('%s', '%s', '%s', '%s', '%s', '%s', '%s', '%s')
        );
        
        return $result !== false ? $wpdb->insert_id : false;
    }
    
    /**
     * Создание таблицы для контактов
     */
    private function create_contacts_table() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        $charset_collate = $wpdb->get_charset_collate();
        
        $sql = "CREATE TABLE IF NOT EXISTS $table_name (
            id mediumint(9) NOT NULL AUTO_INCREMENT,
            first_name varchar(100) NOT NULL,
            last_name varchar(100) NOT NULL,
            email varchar(100) NOT NULL,
            phone varchar(20) NOT NULL,
            ip_address varchar(45),
            user_agent text,
            created_at datetime DEFAULT CURRENT_TIMESTAMP,
            status varchar(20) DEFAULT 'new',
            notes text,
            PRIMARY KEY (id),
            KEY email (email),
            KEY created_at (created_at)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
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
        $message .= "User Agent: " . sanitize_text_field($_SERVER['HTTP_USER_AGENT']) . "\n";
        
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
        // Проверка nonce
        if (!wp_verify_nonce($_POST['nonce'], $this->nonce_action)) {
            wp_send_json_error(array('message' => 'Ошибка безопасности. Обновите страницу и попробуйте снова.'));
        }
        
        // Проверка метода запроса
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            wp_send_json_error(array('message' => 'Неверный метод запроса.'));
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
            wp_send_json_error(array(
                'message' => 'Пожалуйста, исправьте ошибки в форме.',
                'errors' => $errors
            ));
        }
        
        // Проверка на дубликаты (по email)
        global $wpdb;
        $table_name = $wpdb->prefix . 'astarta_contacts';
        $existing = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) FROM $table_name WHERE email = %s AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)",
            $form_data['email']
        ));
        
        if ($existing > 0) {
            wp_send_json_error(array(
                'message' => 'Заявка с этим email уже была отправлена в течение последнего часа.'
            ));
        }
        
        // Сохранение в базу данных
        $contact_id = $this->save_to_database($form_data);
        if (!$contact_id) {
            wp_send_json_error(array(
                'message' => 'Ошибка при сохранении данных. Попробуйте позже.'
            ));
        }
        
        // Отправка уведомлений
        $admin_email_sent = $this->send_email_notification($form_data, $contact_id);
        $client_email_sent = $this->send_client_confirmation($form_data);
        
        // Логирование
        error_log("Astarta Contact Form: New submission ID {$contact_id} from {$form_data['email']}");
        
        // Успешный ответ
        wp_send_json_success(array(
            'message' => 'Спасибо за вашу заявку! Мы свяжемся с вами в ближайшее время.',
            'contact_id' => $contact_id,
            'email_notifications' => array(
                'admin' => $admin_email_sent,
                'client' => $client_email_sent
            )
        ));
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
                <?php wp_nonce_field($this->nonce_action, 'astarta_nonce'); ?>
                
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

// Инициализация обработчика формы
if (class_exists('AstartaFormHandler')) {
    new AstartaFormHandler();
}

// Если файл вызывается напрямую (не через AJAX)
if (!defined('DOING_AJAX') && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $handler = new AstartaFormHandler();
    $handler->handle_form_submission();
}
?>