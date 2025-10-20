<?php
/**
 * Интеграция с Contact Form 7
 * 
 * Если вы используете плагин Contact Form 7, вам нужно будет:
 * 1. Создать форму в админ-панели Contact Form 7
 * 2. Использовать этот код для интеграции
 */

// Пример шорткода для Contact Form 7:
/*
[contact-form-7 id="123" title="Contact form"]

Содержимое формы в Contact Form 7:
<div class="cf7-form-wrapper">
    <div class="input_wrap">
        [text* first-name placeholder "First Name" autocomplete:given-name]
    </div>
    <div class="input_wrap">
        [text* last-name placeholder "Last Name" autocomplete:family-name]
    </div>
    <div class="input_wrap">
        [tel* phone placeholder "Phone Number" autocomplete:tel]
    </div>
    <div class="input_wrap">
        [email* email placeholder "Email Address" autocomplete:email]
    </div>
    [submit class:btn class:btn_secondary "Send"]
</div>
*/

// JavaScript код для интеграции с Contact Form 7
?>
<script>
// Добавьте этот код в ваш main.js для работы с Contact Form 7
function initContactForm7Integration() {
    // Слушаем события Contact Form 7
    document.addEventListener('wpcf7mailsent', function(event) {
        // Успешная отправка
        showNotification('Your message has been sent successfully!', 'success');
        
        // Закрываем попап через 2 секунды
        setTimeout(() => {
            closeFormPopup();
        }, 2000);
    }, false);

    document.addEventListener('wpcf7mailfailed', function(event) {
        // Ошибка отправки
        showNotification('Failed to send your message. Please try again.', 'error');
    }, false);

    document.addEventListener('wpcf7spam', function(event) {
        // Спам
        showNotification('Your message was marked as spam. Please try again.', 'error');
    }, false);

    document.addEventListener('wpcf7invalid', function(event) {
        // Валидация не пройдена
        // Contact Form 7 сам покажет ошибки под полями
    }, false);

    // Кастомизация валидации Contact Form 7
    document.addEventListener('wpcf7init', function(event) {
        const form = event.target;
        if (!form) return;

        // Добавляем классы для стилизации
        const inputs = form.querySelectorAll('.wpcf7-form-control');
        inputs.forEach(input => {
            const wrapper = input.closest('.input_wrap');
            if (wrapper) {
                // Слушаем изменения валидации
                input.addEventListener('wpcf7:invalid', function() {
                    wrapper.classList.add('error');
                });

                input.addEventListener('wpcf7:valid', function() {
                    wrapper.classList.remove('error');
                });
            }
        });
    });
}

// Вызываем функцию при загрузке
document.addEventListener('DOMContentLoaded', initContactForm7Integration);
</script>

<?php
// PHP код для дополнительной обработки Contact Form 7

// Хук для обработки данных перед отправкой
add_action('wpcf7_before_send_mail', 'custom_cf7_before_send_mail');
function custom_cf7_before_send_mail($contact_form) {
    $submission = WPCF7_Submission::get_instance();
    
    if ($submission) {
        $posted_data = $submission->get_posted_data();
        
        // Получаем данные
        $first_name = $posted_data['first-name'] ?? '';
        $last_name = $posted_data['last-name'] ?? '';
        $phone = $posted_data['phone'] ?? '';
        $email = $posted_data['email'] ?? '';
        
        // Сохраняем в базу данных
        if (get_option('save_contact_submissions', false)) {
            save_cf7_submission($first_name, $last_name, $phone, $email);
        }
        
        // Можем модифицировать данные письма
        $mail = $contact_form->prop('mail');
        
        // Добавляем дополнительную информацию
        $additional_content = "\n\n---\nSubmitted from: " . $_SERVER['HTTP_REFERER'];
        $additional_content .= "\nIP: " . $_SERVER['REMOTE_ADDR'];
        $additional_content .= "\nUser Agent: " . $_SERVER['HTTP_USER_AGENT'];
        
        $mail['body'] .= $additional_content;
        
        // Обновляем свойства
        $contact_form->set_properties(array('mail' => $mail));
    }
}

// Сохранение данных Contact Form 7
function save_cf7_submission($first_name, $last_name, $phone, $email) {
    global $wpdb;
    
    $table_name = $wpdb->prefix . 'contact_submissions';
    
    $wpdb->insert(
        $table_name,
        [
            'first_name' => sanitize_text_field($first_name),
            'last_name' => sanitize_text_field($last_name),
            'phone' => sanitize_text_field($phone),
            'email' => sanitize_email($email),
            'submitted_at' => current_time('mysql'),
            'ip_address' => $_SERVER['REMOTE_ADDR'],
            'source' => 'cf7'
        ]
    );
}

// Добавление кастомных тегов для Contact Form 7
add_action('wpcf7_init', 'custom_cf7_add_form_tags');
function custom_cf7_add_form_tags() {
    // Можем добавить кастомные поля если нужно
}

// Стили для Contact Form 7 (добавьте в ваш SCSS)
?>
<style>
/* Стили для Contact Form 7 */
.wpcf7 .input_wrap {
    position: relative;
    margin-bottom: 20px;
}

.wpcf7 .wpcf7-form-control {
    width: 100%;
    background-color: transparent;
    border: none;
    font-size: 18px;
    line-height: 1.11;
    color: #fff;
    padding: 5px 0;
}

.wpcf7 .wpcf7-not-valid-tip {
    position: absolute;
    bottom: -20px;
    left: 0;
    font-size: 12px;
    color: #ff4444;
    line-height: 1;
}

.wpcf7 .wpcf7-response-output {
    display: none !important; /* Скрываем стандартные сообщения, используем свои */
}

.wpcf7 .ajax-loader {
    display: none;
}

.wpcf7 input[type="submit"].wpcf7-submit {
    /* Стили кнопки отправки */
}
</style>