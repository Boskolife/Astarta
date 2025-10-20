jQuery(document).ready(function($) {
    
    // Обновление статуса контакта
    $('.status-select').on('change', function() {
        const contactId = $(this).data('contact-id');
        const newStatus = $(this).val();
        const $select = $(this);
        
        $select.prop('disabled', true).addClass('loading');
        
        $.ajax({
            url: astarta_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'astarta_update_contact_status',
                contact_id: contactId,
                status: newStatus,
                nonce: astarta_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice('Статус успешно обновлен', 'success');
                    
                    // Обновляем цвет строки в зависимости от статуса
                    const $row = $select.closest('tr');
                    $row.removeClass('status-new status-processing status-completed status-cancelled');
                    $row.addClass('status-' + newStatus);
                } else {
                    showNotice('Ошибка при обновлении статуса: ' + response.data.message, 'error');
                }
            },
            error: function() {
                showNotice('Произошла ошибка при обновлении статуса', 'error');
            },
            complete: function() {
                $select.prop('disabled', false).removeClass('loading');
            }
        });
    });
    
    // Удаление контакта
    $('.delete-contact').on('click', function() {
        const contactId = $(this).data('contact-id');
        const $button = $(this);
        const $row = $button.closest('tr');
        
        if (!confirm('Вы уверены, что хотите удалить эту заявку? Это действие нельзя отменить.')) {
            return;
        }
        
        $button.prop('disabled', true).addClass('loading');
        
        $.ajax({
            url: astarta_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'astarta_delete_contact',
                contact_id: contactId,
                nonce: astarta_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success) {
                    showNotice('Заявка успешно удалена', 'success');
                    $row.fadeOut(300, function() {
                        $(this).remove();
                        
                        // Проверяем, остались ли строки в таблице
                        if ($('tbody tr').length === 0) {
                            $('tbody').html('<tr><td colspan="7">Заявки не найдены</td></tr>');
                        }
                    });
                } else {
                    showNotice('Ошибка при удалении заявки: ' + response.data.message, 'error');
                    $button.prop('disabled', false).removeClass('loading');
                }
            },
            error: function() {
                showNotice('Произошла ошибка при удалении заявки', 'error');
                $button.prop('disabled', false).removeClass('loading');
            }
        });
    });
    
    // Просмотр деталей контакта
    $('.view-contact').on('click', function() {
        const contactId = $(this).data('contact-id');
        const $button = $(this);
        
        $button.prop('disabled', true).addClass('loading');
        
        // Получаем данные из строки таблицы
        const $row = $button.closest('tr');
        const contactData = {
            id: contactId,
            name: $row.find('td:eq(1) strong').text(),
            email: $row.find('td:eq(2) a').text(),
            phone: $row.find('td:eq(3) a').text(),
            date: $row.find('td:eq(4)').text(),
            status: $row.find('.status-select option:selected').text(),
            ip: $row.find('.contact-meta').text().replace('IP: ', '')
        };
        
        showContactModal(contactData);
        $button.prop('disabled', false).removeClass('loading');
    });
    
    // Экспорт контактов
    $('#export-contacts').on('click', function() {
        const $button = $(this);
        
        $button.prop('disabled', true).addClass('loading');
        
        // Создаем скрытую форму для отправки POST запроса
        const $form = $('<form>', {
            method: 'POST',
            action: astarta_admin_ajax.ajax_url
        });
        
        $form.append($('<input>', {
            type: 'hidden',
            name: 'action',
            value: 'astarta_export_contacts'
        }));
        
        $form.append($('<input>', {
            type: 'hidden',
            name: 'nonce',
            value: astarta_admin_ajax.nonce
        }));
        
        $('body').append($form);
        $form.submit();
        $form.remove();
        
        setTimeout(function() {
            $button.prop('disabled', false).removeClass('loading');
        }, 2000);
    });
    
    // Модальное окно
    function showContactModal(contactData) {
        const modalHtml = `
            <div id="contact-modal" class="astarta-modal">
                <div class="astarta-modal-content">
                    <span class="astarta-modal-close">&times;</span>
                    <h2>Детали заявки #${contactData.id}</h2>
                    <div id="contact-details">
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">ID:</div>
                            <div class="contact-detail-value">${contactData.id}</div>
                        </div>
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">Имя:</div>
                            <div class="contact-detail-value">${contactData.name}</div>
                        </div>
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">Email:</div>
                            <div class="contact-detail-value">
                                <a href="mailto:${contactData.email}">${contactData.email}</a>
                            </div>
                        </div>
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">Телефон:</div>
                            <div class="contact-detail-value">
                                <a href="tel:${contactData.phone}">${contactData.phone}</a>
                            </div>
                        </div>
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">Дата создания:</div>
                            <div class="contact-detail-value">${contactData.date}</div>
                        </div>
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">Статус:</div>
                            <div class="contact-detail-value">${contactData.status}</div>
                        </div>
                        <div class="contact-detail-row">
                            <div class="contact-detail-label">IP адрес:</div>
                            <div class="contact-detail-value">${contactData.ip}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Удаляем существующее модальное окно
        $('#contact-modal').remove();
        
        // Добавляем новое
        $('body').append(modalHtml);
        
        // Показываем модальное окно
        $('#contact-modal').show();
    }
    
    // Закрытие модального окна
    $(document).on('click', '.astarta-modal-close, .astarta-modal', function(e) {
        if (e.target === this) {
            $('#contact-modal').fadeOut(300, function() {
                $(this).remove();
            });
        }
    });
    
    // Закрытие модального окна по Escape
    $(document).on('keydown', function(e) {
        if (e.key === 'Escape' && $('#contact-modal').is(':visible')) {
            $('#contact-modal').fadeOut(300, function() {
                $(this).remove();
            });
        }
    });
    
    // Показ уведомлений
    function showNotice(message, type = 'info') {
        const noticeClass = type === 'success' ? 'notice-success' : 
                           type === 'error' ? 'notice-error' : 
                           'notice-info';
        
        const $notice = $(`
            <div class="notice astarta-notice ${noticeClass} is-dismissible">
                <p>${message}</p>
                <button type="button" class="notice-dismiss">
                    <span class="screen-reader-text">Скрыть это уведомление.</span>
                </button>
            </div>
        `);
        
        // Удаляем существующие уведомления
        $('.astarta-notice').remove();
        
        // Добавляем новое уведомление
        $('.wrap h1').after($notice);
        
        // Обработчик закрытия
        $notice.on('click', '.notice-dismiss', function() {
            $notice.fadeOut(300, function() {
                $(this).remove();
            });
        });
        
        // Автоматическое скрытие через 5 секунд
        if (type === 'success') {
            setTimeout(function() {
                $notice.fadeOut(300, function() {
                    $(this).remove();
                });
            }, 5000);
        }
    }
    
    // Автообновление статистики каждые 30 секунд
    if ($('.astarta-stats-cards').length > 0) {
        setInterval(function() {
            updateStats();
        }, 30000);
    }
    
    function updateStats() {
        $.ajax({
            url: astarta_admin_ajax.ajax_url,
            type: 'POST',
            data: {
                action: 'astarta_get_stats',
                nonce: astarta_admin_ajax.nonce
            },
            success: function(response) {
                if (response.success && response.data) {
                    const stats = response.data;
                    $('.stats-card .stats-number').each(function() {
                        const $this = $(this);
                        if ($this.hasClass('stats-new')) {
                            $this.text(stats.new || 0);
                        } else if ($this.hasClass('stats-processing')) {
                            $this.text(stats.processing || 0);
                        } else if ($this.hasClass('stats-completed')) {
                            $this.text(stats.completed || 0);
                        } else {
                            $this.text(stats.total || 0);
                        }
                    });
                }
            }
        });
    }
    
    // Подсветка строк по статусу
    $('.status-select').each(function() {
        const status = $(this).val();
        const $row = $(this).closest('tr');
        $row.addClass('status-' + status);
    });
    
    // Поиск в реальном времени (с задержкой)
    let searchTimeout;
    $('input[name="search"]').on('input', function() {
        clearTimeout(searchTimeout);
        const searchValue = $(this).val();
        
        if (searchValue.length >= 3 || searchValue.length === 0) {
            searchTimeout = setTimeout(function() {
                // Автоматически отправляем форму поиска
                $('input[name="search"]').closest('form').submit();
            }, 500);
        }
    });
});