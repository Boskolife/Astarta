<?php
/**
 * Обработчик формы обратной связи для WordPress
 * 
 * Добавьте этот код в файл functions.php вашей темы WordPress
 * или создайте отдельный плагин
 */

// Регистрация AJAX обработчиков
add_action('wp_ajax_submit_contact_form', 'handle_contact_form_submission');
add_action('wp_ajax_nopriv_submit_contact_form', 'handle_contact_form_submission');

/**
 * Обработка отправки формы
 */
function handle_contact_form_submission() {
    // Проверка nonce для безопасности
    if (!isset($_POST['nonce']) || !wp_verify_nonce($_POST['nonce'], 'contact_form_nonce')) {
        wp_send_json_error('Security check failed. Please refresh the page and try again.');
        wp_die();
    }

    // Получение и валидация данных
    $first_name = sanitize_text_field($_POST['firstName'] ?? '');
    $last_name = sanitize_text_field($_POST['lastName'] ?? '');
    $phone = sanitize_text_field($_POST['phone'] ?? '');
    $email = sanitize_email($_POST['email'] ?? '');

    // Валидация обязательных полей
    $errors = [];

    if (empty($first_name)) {
        $errors[] = 'First name is required';
    }

    if (empty($last_name)) {
        $errors[] = 'Last name is required';
    }

    if (empty($phone)) {
        $errors[] = 'Phone number is required';
    }

    if (empty($email)) {
        $errors[] = 'Email is required';
    } elseif (!is_email($email)) {
        $errors[] = 'Please provide a valid email address';
    }

    // Если есть ошибки, отправляем их
    if (!empty($errors)) {
        wp_send_json_error(implode('. ', $errors));
        wp_die();
    }

    // Формирование письма
    $to = get_option('admin_email'); // Email администратора
    $subject = 'New Contact Form Submission from ' . get_bloginfo('name');
    
    $message = "New contact form submission:\n\n";
    $message .= "First Name: {$first_name}\n";
    $message .= "Last Name: {$last_name}\n";
    $message .= "Phone: {$phone}\n";
    $message .= "Email: {$email}\n";
    $message .= "\n";
    $message .= "Submitted on: " . date('Y-m-d H:i:s') . "\n";
    $message .= "IP Address: " . $_SERVER['REMOTE_ADDR'] . "\n";

    $headers = [
        'From: ' . get_bloginfo('name') . ' <' . get_option('admin_email') . '>',
        'Reply-To: ' . $first_name . ' ' . $last_name . ' <' . $email . '>',
        'Content-Type: text/plain; charset=UTF-8'
    ];

    // Альтернативный вариант: HTML письмо
    $html_message = '<html><body>';
    $html_message .= '<h2>New Contact Form Submission</h2>';
    $html_message .= '<table style="border-collapse: collapse; width: 100%;">';
    $html_message .= '<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>First Name:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">' . esc_html($first_name) . '</td></tr>';
    $html_message .= '<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Last Name:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">' . esc_html($last_name) . '</td></tr>';
    $html_message .= '<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Phone:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">' . esc_html($phone) . '</td></tr>';
    $html_message .= '<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td><td style="padding: 10px; border: 1px solid #ddd;"><a href="mailto:' . esc_attr($email) . '">' . esc_html($email) . '</a></td></tr>';
    $html_message .= '<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>Date:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">' . date('Y-m-d H:i:s') . '</td></tr>';
    $html_message .= '<tr><td style="padding: 10px; border: 1px solid #ddd;"><strong>IP Address:</strong></td><td style="padding: 10px; border: 1px solid #ddd;">' . $_SERVER['REMOTE_ADDR'] . '</td></tr>';
    $html_message .= '</table>';
    $html_message .= '</body></html>';

    // Для HTML письма используйте эти заголовки
    $html_headers = [
        'From: ' . get_bloginfo('name') . ' <' . get_option('admin_email') . '>',
        'Reply-To: ' . $first_name . ' ' . $last_name . ' <' . $email . '>',
        'Content-Type: text/html; charset=UTF-8'
    ];

    // Сохранение в базу данных (опционально)
    if (get_option('save_contact_submissions', false)) {
        save_contact_form_submission($first_name, $last_name, $phone, $email);
    }

    // Отправка письма
    $mail_sent = wp_mail($to, $subject, $html_message, $html_headers);

    // Отправка копии пользователю (опционально)
    if (get_option('send_copy_to_user', false)) {
        $user_subject = 'Thank you for contacting ' . get_bloginfo('name');
        $user_message = "Dear {$first_name},\n\n";
        $user_message .= "Thank you for contacting us. We have received your message and will get back to you soon.\n\n";
        $user_message .= "Your submitted information:\n";
        $user_message .= "Name: {$first_name} {$last_name}\n";
        $user_message .= "Phone: {$phone}\n";
        $user_message .= "Email: {$email}\n\n";
        $user_message .= "Best regards,\n" . get_bloginfo('name');
        
        wp_mail($email, $user_subject, $user_message, $headers);
    }

    if ($mail_sent) {
        wp_send_json_success('Your message has been sent successfully!');
    } else {
        // Логирование ошибки
        error_log('Contact form email failed to send for: ' . $email);
        wp_send_json_error('Failed to send your message. Please try again later.');
    }

    wp_die();
}

/**
 * Сохранение данных формы в базу данных
 */
function save_contact_form_submission($first_name, $last_name, $phone, $email) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'contact_submissions';
    
    $wpdb->insert(
        $table_name,
        [
            'first_name' => $first_name,
            'last_name' => $last_name,
            'phone' => $phone,
            'email' => $email,
            'submitted_at' => current_time('mysql'),
            'ip_address' => $_SERVER['REMOTE_ADDR']
        ]
    );
}

/**
 * Создание таблицы для хранения заявок (опционально)
 */
function create_contact_submissions_table() {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'contact_submissions';
    $charset_collate = $wpdb->get_charset_collate();
    
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id int(11) NOT NULL AUTO_INCREMENT,
        first_name varchar(100) NOT NULL,
        last_name varchar(100) NOT NULL,
        phone varchar(50) NOT NULL,
        email varchar(100) NOT NULL,
        submitted_at datetime DEFAULT CURRENT_TIMESTAMP,
        ip_address varchar(45),
        status varchar(20) DEFAULT 'new',
        PRIMARY KEY (id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
}

// Активация создания таблицы при активации темы/плагина
add_action('after_switch_theme', 'create_contact_submissions_table');

/**
 * Добавление nonce в JavaScript
 */
function add_contact_form_nonce() {
    ?>
    <script type="text/javascript">
        window.contact_form_nonce = '<?php echo wp_create_nonce('contact_form_nonce'); ?>';
    </script>
    <?php
}
add_action('wp_head', 'add_contact_form_nonce');

/**
 * Добавление страницы в админ-панель для просмотра заявок
 */
function add_contact_submissions_menu() {
    add_menu_page(
        'Contact Submissions',
        'Contact Forms',
        'manage_options',
        'contact-submissions',
        'display_contact_submissions_page',
        'dashicons-email-alt',
        30
    );
}
add_action('admin_menu', 'add_contact_submissions_menu');

/**
 * Страница отображения заявок в админ-панели
 */
function display_contact_submissions_page() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'contact_submissions';
    
    // Проверка существования таблицы
    if ($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
        echo '<div class="wrap"><h1>Contact Submissions</h1><p>No submissions table found. Please reactivate the theme.</p></div>';
        return;
    }
    
    $submissions = $wpdb->get_results("SELECT * FROM $table_name ORDER BY submitted_at DESC LIMIT 100");
    
    ?>
    <div class="wrap">
        <h1>Contact Form Submissions</h1>
        
        <?php if (empty($submissions)) : ?>
            <p>No submissions yet.</p>
        <?php else : ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Submitted</th>
                        <th>IP Address</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($submissions as $submission) : ?>
                        <tr>
                            <td><?php echo esc_html($submission->id); ?></td>
                            <td><?php echo esc_html($submission->first_name . ' ' . $submission->last_name); ?></td>
                            <td><a href="mailto:<?php echo esc_attr($submission->email); ?>"><?php echo esc_html($submission->email); ?></a></td>
                            <td><?php echo esc_html($submission->phone); ?></td>
                            <td><?php echo esc_html($submission->submitted_at); ?></td>
                            <td><?php echo esc_html($submission->ip_address); ?></td>
                            <td><?php echo esc_html($submission->status); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}

/**
 * Настройки для формы
 */
function register_contact_form_settings() {
    add_settings_section(
        'contact_form_settings',
        'Contact Form Settings',
        null,
        'general'
    );
    
    add_settings_field(
        'save_contact_submissions',
        'Save submissions to database',
        'render_save_submissions_field',
        'general',
        'contact_form_settings'
    );
    
    add_settings_field(
        'send_copy_to_user',
        'Send confirmation email to user',
        'render_send_copy_field',
        'general',
        'contact_form_settings'
    );
    
    register_setting('general', 'save_contact_submissions');
    register_setting('general', 'send_copy_to_user');
}
add_action('admin_init', 'register_contact_form_settings');

function render_save_submissions_field() {
    $value = get_option('save_contact_submissions', false);
    ?>
    <input type="checkbox" name="save_contact_submissions" value="1" <?php checked($value, 1); ?> />
    <label>Save form submissions to database for later review</label>
    <?php
}

function render_send_copy_field() {
    $value = get_option('send_copy_to_user', false);
    ?>
    <input type="checkbox" name="send_copy_to_user" value="1" <?php checked($value, 1); ?> />
    <label>Send confirmation email to user after form submission</label>
    <?php
}