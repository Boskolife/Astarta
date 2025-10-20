<?php
/**
 * Astarta Capital WordPress Theme Functions
 */

// Подключаем стили и скрипты
function astarta_enqueue_scripts() {
    // Подключаем стили
    wp_enqueue_style('astarta-style', get_template_directory_uri() . '/style.css', array(), '1.0.0');
    
    // Подключаем скрипты
    wp_enqueue_script('astarta-main', get_template_directory_uri() . '/js/main.js', array(), '1.0.0', true);
    
    // Локализуем скрипт для передачи nonce
    wp_localize_script('astarta-main', 'astartaAjax', array(
        'ajaxurl' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('contact_form_nonce'),
        'contactFormNonce' => wp_create_nonce('contact_form_nonce')
    ));
}
add_action('wp_enqueue_scripts', 'astarta_enqueue_scripts');

// AJAX обработчик для формы
function handle_contact_form_ajax() {
    // Проверяем nonce
    if (!wp_verify_nonce($_POST['nonce'], 'contact_form_nonce')) {
        wp_die('Неверный nonce', 'Ошибка безопасности', array('response' => 403));
    }
    
    // Получаем и очищаем данные формы
    $first_name = sanitize_text_field($_POST['firstName'] ?? '');
    $last_name = sanitize_text_field($_POST['lastName'] ?? '');
    $phone = sanitize_text_field($_POST['phone'] ?? '');
    $email = sanitize_email($_POST['email'] ?? '');
    
    // Валидация данных
    $errors = array();
    
    if (empty($first_name)) {
        $errors[] = 'Имя обязательно для заполнения';
    }
    
    if (empty($last_name)) {
        $errors[] = 'Фамилия обязательна для заполнения';
    }
    
    if (empty($email) || !is_email($email)) {
        $errors[] = 'Введите корректный email адрес';
    }
    
    if (empty($phone)) {
        $errors[] = 'Номер телефона обязателен для заполнения';
    }
    
    // Если есть ошибки, возвращаем их
    if (!empty($errors)) {
        wp_send_json_error(array(
            'message' => 'Ошибки валидации',
            'errors' => $errors
        ));
    }
    
    // Подготавливаем данные для сохранения
    $form_data = array(
        'first_name' => $first_name,
        'last_name' => $last_name,
        'phone' => $phone,
        'email' => $email,
        'submitted_at' => current_time('mysql'),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? '',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? ''
    );
    
    // Сохраняем в базу данных
    global $wpdb;
    $table_name = $wpdb->prefix . 'contact_submissions';
    
    // Создаем таблицу если её нет
    $charset_collate = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id mediumint(9) NOT NULL AUTO_INCREMENT,
        first_name varchar(100) NOT NULL,
        last_name varchar(100) NOT NULL,
        phone varchar(20) NOT NULL,
        email varchar(100) NOT NULL,
        submitted_at datetime DEFAULT CURRENT_TIMESTAMP,
        ip_address varchar(45) DEFAULT '',
        user_agent text DEFAULT '',
        status varchar(20) DEFAULT 'new',
        PRIMARY KEY (id)
    ) $charset_collate;";
    
    require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
    dbDelta($sql);
    
    // Вставляем данные
    $result = $wpdb->insert(
        $table_name,
        $form_data,
        array('%s', '%s', '%s', '%s', '%s', '%s', '%s')
    );
    
    if ($result === false) {
        wp_send_json_error(array(
            'message' => 'Ошибка сохранения данных'
        ));
    }
    
    // Отправляем email уведомление администратору
    $admin_email = get_option('admin_email');
    $site_name = get_option('blogname');
    
    $subject = "Новая заявка с сайта $site_name";
    $message = "
    Новая заявка с сайта $site_name:
    
    Имя: $first_name
    Фамилия: $last_name
    Телефон: $phone
    Email: $email
    Дата отправки: " . current_time('d.m.Y H:i') . "
    IP адрес: " . ($_SERVER['REMOTE_ADDR'] ?? 'неизвестно') . "
    
    ---
    Это сообщение отправлено автоматически с сайта $site_name
    ";
    
    $headers = array('Content-Type: text/html; charset=UTF-8');
    wp_mail($admin_email, $subject, nl2br($message), $headers);
    
    // Отправляем подтверждение пользователю
    $user_subject = "Спасибо за обращение - $site_name";
    $user_message = "
    Здравствуйте, $first_name!
    
    Спасибо за ваш интерес к Astarta Capital. 
    Мы получили вашу заявку и свяжемся с вами в ближайшее время.
    
    С уважением,
    Команда Astarta Capital
    ";
    
    wp_mail($email, $user_subject, nl2br($user_message), $headers);
    
    // Возвращаем успешный ответ
    wp_send_json_success(array(
        'message' => 'Форма успешно отправлена! Мы свяжемся с вами в ближайшее время.'
    ));
}
add_action('wp_ajax_handle_contact_form', 'handle_contact_form_ajax');
add_action('wp_ajax_nopriv_handle_contact_form', 'handle_contact_form_ajax');

// Создаем админ-страницу для просмотра заявок
function astarta_add_admin_menu() {
    add_menu_page(
        'Заявки с сайта',
        'Заявки',
        'manage_options',
        'astarta-submissions',
        'astarta_submissions_page',
        'dashicons-email-alt',
        30
    );
}
add_action('admin_menu', 'astarta_add_admin_menu');

// Страница с заявками в админке
function astarta_submissions_page() {
    global $wpdb;
    $table_name = $wpdb->prefix . 'contact_submissions';
    
    // Получаем заявки
    $submissions = $wpdb->get_results("SELECT * FROM $table_name ORDER BY submitted_at DESC");
    
    echo '<div class="wrap">';
    echo '<h1>Заявки с сайта</h1>';
    
    if (empty($submissions)) {
        echo '<p>Заявок пока нет.</p>';
    } else {
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr>';
        echo '<th>ID</th>';
        echo '<th>Имя</th>';
        echo '<th>Фамилия</th>';
        echo '<th>Email</th>';
        echo '<th>Телефон</th>';
        echo '<th>Дата</th>';
        echo '<th>Статус</th>';
        echo '</tr></thead>';
        echo '<tbody>';
        
        foreach ($submissions as $submission) {
            echo '<tr>';
            echo '<td>' . esc_html($submission->id) . '</td>';
            echo '<td>' . esc_html($submission->first_name) . '</td>';
            echo '<td>' . esc_html($submission->last_name) . '</td>';
            echo '<td><a href="mailto:' . esc_attr($submission->email) . '">' . esc_html($submission->email) . '</a></td>';
            echo '<td><a href="tel:' . esc_attr($submission->phone) . '">' . esc_html($submission->phone) . '</a></td>';
            echo '<td>' . esc_html($submission->submitted_at) . '</td>';
            echo '<td>' . esc_html($submission->status) . '</td>';
            echo '</tr>';
        }
        
        echo '</tbody>';
        echo '</table>';
    }
    
    echo '</div>';
}

// Добавляем поддержку темы
function astarta_theme_support() {
    add_theme_support('post-thumbnails');
    add_theme_support('title-tag');
    add_theme_support('html5', array('search-form', 'comment-form', 'comment-list', 'gallery', 'caption'));
}
add_action('after_setup_theme', 'astarta_theme_support');
?>