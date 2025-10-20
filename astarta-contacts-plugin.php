<?php
/**
 * Plugin Name: Astarta Contacts Manager
 * Plugin URI: https://astartacapital.com
 * Description: Управление заявками с формы обратной связи Astarta Capital
 * Version: 1.0.0
 * Author: Astarta Capital
 * License: GPL v2 or later
 * Text Domain: astarta-contacts
 */

// Предотвращаем прямой доступ
if (!defined('ABSPATH')) {
    exit;
}

// Определяем константы плагина
define('ASTARTA_CONTACTS_VERSION', '1.0.0');
define('ASTARTA_CONTACTS_PLUGIN_URL', plugin_dir_url(__FILE__));
define('ASTARTA_CONTACTS_PLUGIN_PATH', plugin_dir_path(__FILE__));

/**
 * Главный класс плагина
 */
class AstartaContactsPlugin {
    
    public function __construct() {
        add_action('init', array($this, 'init'));
        register_activation_hook(__FILE__, array($this, 'activate'));
        register_deactivation_hook(__FILE__, array($this, 'deactivate'));
    }
    
    public function init() {
        // Подключаем обработчик формы
        require_once ASTARTA_CONTACTS_PLUGIN_PATH . 'includes/class-form-handler.php';
        
        // Подключаем админ панель
        if (is_admin()) {
            require_once ASTARTA_CONTACTS_PLUGIN_PATH . 'includes/class-admin.php';
            new AstartaContactsAdmin();
        }
        
        // Инициализируем обработчик формы
        new AstartaFormHandler();
    }
    
    public function activate() {
        // Создаем таблицу при активации плагина
        $this->create_contacts_table();
        
        // Устанавливаем права доступа
        $role = get_role('administrator');
        if ($role) {
            $role->add_cap('manage_astarta_contacts');
        }
    }
    
    public function deactivate() {
        // Удаляем права доступа
        $role = get_role('administrator');
        if ($role) {
            $role->remove_cap('manage_astarta_contacts');
        }
    }
    
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
            KEY created_at (created_at),
            KEY status (status)
        ) $charset_collate;";
        
        require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
        dbDelta($sql);
    }
}

/**
 * Админ панель для управления контактами
 */
class AstartaContactsAdmin {
    
    public function __construct() {
        add_action('admin_menu', array($this, 'add_admin_menu'));
        add_action('admin_enqueue_scripts', array($this, 'enqueue_admin_scripts'));
        add_action('wp_ajax_astarta_update_contact_status', array($this, 'update_contact_status'));
        add_action('wp_ajax_astarta_delete_contact', array($this, 'delete_contact'));
        add_action('wp_ajax_astarta_export_contacts', array($this, 'export_contacts'));
    }
    
    public function add_admin_menu() {
        add_menu_page(
            'Astarta Contacts',
            'Astarta Contacts',
            'manage_astarta_contacts',
            'astarta-contacts',
            array($this, 'admin_page'),
            'dashicons-email-alt',
            30
        );
        
        add_submenu_page(
            'astarta-contacts',
            'Все заявки',
            'Все заявки',
            'manage_astarta_contacts',
            'astarta-contacts',
            array($this, 'admin_page')
        );
        
        add_submenu_page(
            'astarta-contacts',
            'Статистика',
            'Статистика',
            'manage_astarta_contacts',
            'astarta-contacts-stats',
            array($this, 'stats_page')
        );
    }
    
    public function enqueue_admin_scripts($hook) {
        if (strpos($hook, 'astarta-contacts') === false) {
            return;
        }
        
        wp_enqueue_script('jquery');
        wp_enqueue_script('astarta-admin-js', ASTARTA_CONTACTS_PLUGIN_URL . 'assets/admin.js', array('jquery'), ASTARTA_CONTACTS_VERSION);
        wp_enqueue_style('astarta-admin-css', ASTARTA_CONTACTS_PLUGIN_URL . 'assets/admin.css', array(), ASTARTA_CONTACTS_VERSION);
        
        wp_localize_script('astarta-admin-js', 'astarta_admin_ajax', array(
            'ajax_url' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('astarta_admin_nonce')
        ));
    }
    
    public function admin_page() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        // Обработка фильтров
        $status_filter = isset($_GET['status']) ? sanitize_text_field($_GET['status']) : '';
        $search = isset($_GET['search']) ? sanitize_text_field($_GET['search']) : '';
        
        // Пагинация
        $per_page = 20;
        $current_page = isset($_GET['paged']) ? max(1, intval($_GET['paged'])) : 1;
        $offset = ($current_page - 1) * $per_page;
        
        // Построение запроса
        $where_conditions = array();
        $query_params = array();
        
        if ($status_filter) {
            $where_conditions[] = "status = %s";
            $query_params[] = $status_filter;
        }
        
        if ($search) {
            $where_conditions[] = "(first_name LIKE %s OR last_name LIKE %s OR email LIKE %s OR phone LIKE %s)";
            $search_param = '%' . $wpdb->esc_like($search) . '%';
            $query_params = array_merge($query_params, array($search_param, $search_param, $search_param, $search_param));
        }
        
        $where_clause = '';
        if (!empty($where_conditions)) {
            $where_clause = 'WHERE ' . implode(' AND ', $where_conditions);
        }
        
        // Получение данных
        $query = "SELECT * FROM $table_name $where_clause ORDER BY created_at DESC LIMIT %d OFFSET %d";
        $query_params[] = $per_page;
        $query_params[] = $offset;
        
        $contacts = $wpdb->get_results($wpdb->prepare($query, $query_params));
        
        // Подсчет общего количества
        $count_query = "SELECT COUNT(*) FROM $table_name $where_clause";
        $total_items = $wpdb->get_var($wpdb->prepare($count_query, array_slice($query_params, 0, -2)));
        
        $total_pages = ceil($total_items / $per_page);
        
        // Статистика
        $stats = $this->get_contacts_stats();
        
        ?>
        <div class="wrap">
            <h1>Заявки Astarta Capital</h1>
            
            <!-- Статистика -->
            <div class="astarta-stats-cards">
                <div class="stats-card">
                    <h3>Всего заявок</h3>
                    <span class="stats-number"><?php echo $stats['total']; ?></span>
                </div>
                <div class="stats-card">
                    <h3>Новые</h3>
                    <span class="stats-number stats-new"><?php echo $stats['new']; ?></span>
                </div>
                <div class="stats-card">
                    <h3>В работе</h3>
                    <span class="stats-number stats-processing"><?php echo $stats['processing']; ?></span>
                </div>
                <div class="stats-card">
                    <h3>Завершенные</h3>
                    <span class="stats-number stats-completed"><?php echo $stats['completed']; ?></span>
                </div>
            </div>
            
            <!-- Фильтры -->
            <div class="astarta-filters">
                <form method="get">
                    <input type="hidden" name="page" value="astarta-contacts">
                    
                    <select name="status">
                        <option value="">Все статусы</option>
                        <option value="new" <?php selected($status_filter, 'new'); ?>>Новые</option>
                        <option value="processing" <?php selected($status_filter, 'processing'); ?>>В работе</option>
                        <option value="completed" <?php selected($status_filter, 'completed'); ?>>Завершенные</option>
                        <option value="cancelled" <?php selected($status_filter, 'cancelled'); ?>>Отмененные</option>
                    </select>
                    
                    <input type="text" name="search" value="<?php echo esc_attr($search); ?>" placeholder="Поиск по имени, email, телефону...">
                    
                    <input type="submit" class="button" value="Фильтровать">
                    
                    <?php if ($status_filter || $search): ?>
                        <a href="<?php echo admin_url('admin.php?page=astarta-contacts'); ?>" class="button">Сбросить</a>
                    <?php endif; ?>
                    
                    <button type="button" class="button button-secondary" id="export-contacts">Экспорт CSV</button>
                </form>
            </div>
            
            <!-- Таблица контактов -->
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Имя</th>
                        <th>Email</th>
                        <th>Телефон</th>
                        <th>Дата</th>
                        <th>Статус</th>
                        <th>Действия</th>
                    </tr>
                </thead>
                <tbody>
                    <?php if (empty($contacts)): ?>
                        <tr>
                            <td colspan="7">Заявки не найдены</td>
                        </tr>
                    <?php else: ?>
                        <?php foreach ($contacts as $contact): ?>
                            <tr data-contact-id="<?php echo $contact->id; ?>">
                                <td><?php echo $contact->id; ?></td>
                                <td>
                                    <strong><?php echo esc_html($contact->first_name . ' ' . $contact->last_name); ?></strong>
                                    <div class="contact-meta">
                                        IP: <?php echo esc_html($contact->ip_address); ?>
                                    </div>
                                </td>
                                <td>
                                    <a href="mailto:<?php echo esc_attr($contact->email); ?>">
                                        <?php echo esc_html($contact->email); ?>
                                    </a>
                                </td>
                                <td>
                                    <a href="tel:<?php echo esc_attr($contact->phone); ?>">
                                        <?php echo esc_html($contact->phone); ?>
                                    </a>
                                </td>
                                <td>
                                    <?php echo date('d.m.Y H:i', strtotime($contact->created_at)); ?>
                                </td>
                                <td>
                                    <select class="status-select" data-contact-id="<?php echo $contact->id; ?>">
                                        <option value="new" <?php selected($contact->status, 'new'); ?>>Новая</option>
                                        <option value="processing" <?php selected($contact->status, 'processing'); ?>>В работе</option>
                                        <option value="completed" <?php selected($contact->status, 'completed'); ?>>Завершена</option>
                                        <option value="cancelled" <?php selected($contact->status, 'cancelled'); ?>>Отменена</option>
                                    </select>
                                </td>
                                <td>
                                    <button class="button button-small view-contact" data-contact-id="<?php echo $contact->id; ?>">
                                        Просмотр
                                    </button>
                                    <button class="button button-small button-link-delete delete-contact" data-contact-id="<?php echo $contact->id; ?>">
                                        Удалить
                                    </button>
                                </td>
                            </tr>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </tbody>
            </table>
            
            <!-- Пагинация -->
            <?php if ($total_pages > 1): ?>
                <div class="tablenav">
                    <div class="tablenav-pages">
                        <?php
                        $page_links = paginate_links(array(
                            'base' => add_query_arg('paged', '%#%'),
                            'format' => '',
                            'prev_text' => '&laquo;',
                            'next_text' => '&raquo;',
                            'total' => $total_pages,
                            'current' => $current_page
                        ));
                        echo $page_links;
                        ?>
                    </div>
                </div>
            <?php endif; ?>
        </div>
        
        <!-- Модальное окно для просмотра контакта -->
        <div id="contact-modal" class="astarta-modal" style="display: none;">
            <div class="astarta-modal-content">
                <span class="astarta-modal-close">&times;</span>
                <h2>Детали заявки</h2>
                <div id="contact-details"></div>
            </div>
        </div>
        <?php
    }
    
    public function stats_page() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        // Статистика по дням за последние 30 дней
        $daily_stats = $wpdb->get_results("
            SELECT 
                DATE(created_at) as date,
                COUNT(*) as count
            FROM $table_name 
            WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY DATE(created_at)
            ORDER BY date DESC
        ");
        
        // Статистика по статусам
        $status_stats = $wpdb->get_results("
            SELECT 
                status,
                COUNT(*) as count
            FROM $table_name 
            GROUP BY status
        ");
        
        ?>
        <div class="wrap">
            <h1>Статистика заявок</h1>
            
            <div class="astarta-stats-section">
                <h2>Заявки за последние 30 дней</h2>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>Дата</th>
                            <th>Количество заявок</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($daily_stats as $stat): ?>
                            <tr>
                                <td><?php echo date('d.m.Y', strtotime($stat->date)); ?></td>
                                <td><?php echo $stat->count; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
            
            <div class="astarta-stats-section">
                <h2>Статистика по статусам</h2>
                <table class="wp-list-table widefat fixed striped">
                    <thead>
                        <tr>
                            <th>Статус</th>
                            <th>Количество</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($status_stats as $stat): ?>
                            <tr>
                                <td>
                                    <?php
                                    $status_labels = array(
                                        'new' => 'Новые',
                                        'processing' => 'В работе',
                                        'completed' => 'Завершенные',
                                        'cancelled' => 'Отмененные'
                                    );
                                    echo $status_labels[$stat->status] ?? $stat->status;
                                    ?>
                                </td>
                                <td><?php echo $stat->count; ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
        <?php
    }
    
    private function get_contacts_stats() {
        global $wpdb;
        
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        $stats = array(
            'total' => $wpdb->get_var("SELECT COUNT(*) FROM $table_name"),
            'new' => $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE status = 'new'"),
            'processing' => $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE status = 'processing'"),
            'completed' => $wpdb->get_var("SELECT COUNT(*) FROM $table_name WHERE status = 'completed'"),
        );
        
        return $stats;
    }
    
    public function update_contact_status() {
        check_ajax_referer('astarta_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_astarta_contacts')) {
            wp_die('Недостаточно прав доступа');
        }
        
        $contact_id = intval($_POST['contact_id']);
        $status = sanitize_text_field($_POST['status']);
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        $result = $wpdb->update(
            $table_name,
            array('status' => $status),
            array('id' => $contact_id),
            array('%s'),
            array('%d')
        );
        
        if ($result !== false) {
            wp_send_json_success(array('message' => 'Статус обновлен'));
        } else {
            wp_send_json_error(array('message' => 'Ошибка при обновлении статуса'));
        }
    }
    
    public function delete_contact() {
        check_ajax_referer('astarta_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_astarta_contacts')) {
            wp_die('Недостаточно прав доступа');
        }
        
        $contact_id = intval($_POST['contact_id']);
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        $result = $wpdb->delete(
            $table_name,
            array('id' => $contact_id),
            array('%d')
        );
        
        if ($result !== false) {
            wp_send_json_success(array('message' => 'Заявка удалена'));
        } else {
            wp_send_json_error(array('message' => 'Ошибка при удалении заявки'));
        }
    }
    
    public function export_contacts() {
        check_ajax_referer('astarta_admin_nonce', 'nonce');
        
        if (!current_user_can('manage_astarta_contacts')) {
            wp_die('Недостаточно прав доступа');
        }
        
        global $wpdb;
        $table_name = $wpdb->prefix . 'astarta_contacts';
        
        $contacts = $wpdb->get_results("SELECT * FROM $table_name ORDER BY created_at DESC");
        
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename=astarta-contacts-' . date('Y-m-d') . '.csv');
        
        $output = fopen('php://output', 'w');
        
        // Заголовки CSV
        fputcsv($output, array(
            'ID',
            'Имя',
            'Фамилия',
            'Email',
            'Телефон',
            'IP адрес',
            'Дата создания',
            'Статус',
            'Заметки'
        ));
        
        // Данные
        foreach ($contacts as $contact) {
            fputcsv($output, array(
                $contact->id,
                $contact->first_name,
                $contact->last_name,
                $contact->email,
                $contact->phone,
                $contact->ip_address,
                $contact->created_at,
                $contact->status,
                $contact->notes
            ));
        }
        
        fclose($output);
        exit;
    }
}

// Инициализация плагина
new AstartaContactsPlugin();
?>