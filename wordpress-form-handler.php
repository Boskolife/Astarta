<?php
/**
 * WordPress Form Handler для Astarta Capital
 * Обрабатывает отправку контактных форм
 */

// Подключаем WordPress
require_once('wp-config.php');
require_once('wp-load.php');

// Проверяем, что это POST запрос
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    wp_die('Метод не разрешен', 'Ошибка', array('response' => 405));
}

// Проверяем nonce для безопасности
if (!wp_verify_nonce($_POST['form_nonce'], 'contact_form_nonce')) {
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
?>