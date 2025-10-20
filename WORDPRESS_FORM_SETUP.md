# Инструкция по настройке формы обратной связи в WordPress

## Вариант 1: Собственная обработка формы

### 1. Добавление PHP кода

Скопируйте содержимое файла `wordpress-form-handler.php` в файл `functions.php` вашей темы WordPress.

### 2. Обновление JavaScript

JavaScript код для обработки формы уже добавлен в файл `src/js/main.js`. После сборки проекта убедитесь, что скомпилированный JavaScript файл подключен в вашей теме WordPress.

### 3. Настройка

В админ-панели WordPress перейдите в **Настройки → Общие** и найдите секцию "Contact Form Settings". Здесь вы можете:
- Включить сохранение заявок в базу данных
- Включить отправку подтверждения пользователю

### 4. Просмотр заявок

После активации сохранения заявок, в админ-панели появится пункт меню **Contact Forms**, где вы сможете просматривать все отправленные заявки.

## Вариант 2: Использование Contact Form 7

### 1. Установка плагина

1. В админ-панели WordPress перейдите в **Плагины → Добавить новый**
2. Найдите "Contact Form 7"
3. Установите и активируйте плагин

### 2. Создание формы

1. Перейдите в **Contact → Add New**
2. Вставьте следующий код формы:

```
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
```

3. Настройте получателя и тему письма во вкладке "Mail"
4. Сохраните форму и скопируйте ID формы

### 3. Обновление HTML

В файле `src/templates/form.html` замените существующую форму на:

```html
<div id="form-popup" class="form_body">
    <button class="form-popup-close" aria-label="Close form">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    </button>
    <div class="form_inner">
        <h2>Contact us to explore partnership opportunities.</h2>
        [contact-form-7 id="YOUR_FORM_ID" title="Contact form"]
    </div>
</div>
```

Замените `YOUR_FORM_ID` на ID вашей формы.

### 4. Добавление интеграции

Добавьте код из файла `contact-form-7-integration.php` в `functions.php` вашей темы.

## Тестирование

### Проверьте следующее:

1. **Валидация полей** - все поля должны проверяться на корректность
2. **Отправка формы** - форма должна отправляться без перезагрузки страницы
3. **Уведомления** - должны показываться уведомления об успехе/ошибке
4. **Email** - проверьте, что письма приходят на указанный email
5. **Мобильная версия** - форма должна корректно работать на мобильных устройствах

## Настройка email

### Для улучшения доставляемости писем рекомендуется:

1. Установить плагин **WP Mail SMTP**
2. Настроить SMTP сервер (Gmail, SendGrid, Mailgun и т.д.)
3. Добавить SPF и DKIM записи для вашего домена

## Безопасность

### Встроенные меры безопасности:

- **Nonce проверка** - защита от CSRF атак
- **Санитизация данных** - очистка всех входных данных
- **Валидация email** - проверка корректности email адресов
- **Ограничение доступа** - только авторизованные пользователи могут просматривать заявки

## Дополнительные возможности

### Вы можете расширить функциональность:

1. **Добавить капчу** - используйте Google reCAPTCHA
2. **Интеграция с CRM** - отправляйте данные в вашу CRM систему
3. **Уведомления в Telegram** - настройте отправку уведомлений в Telegram
4. **Экспорт данных** - добавьте возможность экспорта заявок в CSV/Excel

## Проблемы и решения

### Форма не отправляется
- Проверьте, что nonce правильно генерируется
- Убедитесь, что AJAX URL корректный
- Проверьте консоль браузера на наличие ошибок

### Письма не приходят
- Проверьте спам папку
- Настройте SMTP
- Проверьте логи сервера

### Ошибка 403/404 при отправке
- Проверьте права доступа к admin-ajax.php
- Убедитесь, что action правильно зарегистрирован