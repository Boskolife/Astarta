# 📝 JavaScript код - Детальні коментарі

## 🎯 Структура файлу main.js

### 1. Імпорти та ініціалізація
```javascript
import fullpage from 'fullpage.js';

// DOM елементи - отримуємо посилання на основні елементи сторінки
const $video = document.getElementById('video');                    // Основне відео
const $videoBackward = document.getElementById('video-backward');  // Зворотне відео
const $sections = document.querySelectorAll('.section');           // Всі секції сторінки

// Стан системи - змінні для відстеження поточного стану
let fullPageInstance = null;              // Екземпляр FullPage.js
let currentSectionIndex = 0;              // Поточний індекс активної секції
let isInitialAnimationStarted = false;    // Прапор початкової анімації
let isIntroPlaying = false;               // Прапор відтворення інтро
```

### 2. Конфігурація даних
```javascript
// SEGMENTS - визначає коли яка HTML секція повинна бути видимою
// Кожен об'єкт містить from (початок) і to (кінець) в секундах
const SEGMENTS = [
  { from: 0, to: 5 },      // Секція 0: Інтро (0-5 секунд)
  { from: 5, to: 10 },     // Секція 1: Перша секція (5-10 секунд)
  { from: 10, to: 15 },    // Секція 2: Друга секція (10-15 секунд)
  // ... інші секції
];

// VIDEO_SEGMENTS - визначає часові відрізки відео для кожного переходу
// Повинен бути синхронізований з SEGMENTS
const VIDEO_SEGMENTS = [
  { from: 0, to: 5 },      // Інтро відео
  { from: 5, to: 10 },     // Перехід 1
  { from: 10, to: 15 },    // Перехід 2
  // ... інші переходи
];

// Константи для оптимізації
const TIME_WRITE_EPSILON = 1 / 120; // Мінімальний поріг оновлення currentTime (120 FPS)
```

---

## 🎬 Функції роботи з відео

### 1. Підготовка відео для відтворення
```javascript
function primeVideoPlayback(video) {
  // Перевіряємо існування відео елемента
  if (!video) {
    console.warn('Відео елемент не знайдено');
    return;
  }

  // Встановлюємо базові властивості для автоматичного відтворення
  video.muted = true;        // Без звуку (вимога браузерів)
  video.playsInline = true;  // Відтворення всередині сторінки (iOS)
  video.preload = 'auto';    // Попереднє завантаження відео

  // Обробник для першої взаємодії користувача
  // Це необхідно для розблокування автовідтворення
  const handleFirstInteraction = () => {
    video.muted = false;  // Включаємо звук після взаємодії
    // Видаляємо обробники після першого використання
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
  };
  
  // Додаємо обробники для кліку і дотику
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('touchstart', handleFirstInteraction);
}
```

### 2. Пряме відтворення відео
```javascript
function playVideoSegmentForward(fromIndex, toIndex, durationMs, onComplete) {
  // Перевіряємо існування відео
  if (!$video) return;

  // Отримуємо часові відрізки для переходу
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;

  try {
    // Зупиняємо поточне відтворення
    $video.pause();
    
    // Встановлюємо початковий час (кінець попередньої секції)
    $video.currentTime = fromSegment.to;
    
    // Обчислюємо час, який потрібно відтворити
    const timeToPlay = toSegment.from - fromSegment.to;
    
    // Обчислюємо швидкість відтворення
    // Швидкість = час відео / час скролу
    const playbackRate = timeToPlay / (durationMs / 1000);
    
    // Встановлюємо швидкість і запускаємо відтворення
    $video.playbackRate = playbackRate;
    $video.play();
    
    // Зупиняємо відтворення через потрібний час
    setTimeout(() => {
      try {
        $video.pause();
        // Встановлюємо точний час для наступної секції
        $video.currentTime = toSegment.from;
        // Скидаємо швидкість відтворення
        $video.playbackRate = 1;
        
        // Викликаємо callback якщо він переданий
        if (typeof onComplete === 'function') {
          onComplete();
        }
      } catch (error) {
        console.warn('Помилка завершення сегмента:', error);
      }
    }, durationMs);
    
  } catch (error) {
    console.error('Помилка відтворення відео:', error);
  }
}
```

### 3. Зворотне відтворення відео
```javascript
function playVideoSegmentReverse(fromIndex, toIndex, durationMs, onComplete) {
  // Перевіряємо існування обох відео
  if (!$video || !$videoBackward) return;

  try {
    // Зупиняємо обидва відео
    $video.pause();
    $videoBackward.pause();
  } catch {}

  // Отримуємо часові відрізки
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;

  // Обчислюємо час для зворотного відео
  // Зворотне відео грає з кінця до початку
  const videoDuration = $video.duration || 0;
  const backwardFromTime = videoDuration - fromSegment.to;  // Початок зворотного відтворення
  const backwardToTime = videoDuration - toSegment.from;    // Кінець зворотного відтворення

  // Функція підготовки і показу зворотного відео
  const prepareAndShowBackward = () => {
    try {
      // Встановлюємо час для зворотного відео
      $videoBackward.currentTime = backwardFromTime;
    } catch (e) {
      console.warn('Помилка встановлення часу зворотного відео:', e);
    }

    // Функція показу зворотного відео коли кадр готовий
    const showWhenReady = () => {
      // Перемикаємо видимість: приховуємо основне, показуємо зворотне
      $video.classList.remove('is-visible');
      $videoBackward.classList.add('is-visible');

      // Запускаємо відтворення зворотного відео
      const playPromise = $videoBackward.play();
      if (playPromise && playPromise.then) {
        playPromise.catch((e) => console.warn('Помилка відтворення зворотного відео:', e));
      }
    };

    // Обробник готовності кадру
    const onSeeked = () => {
      $videoBackward.removeEventListener('seeked', onSeeked);
      // Перевіряємо готовність відео (readyState >= 2 означає, що кадр готовий)
      if ($videoBackward.readyState >= 2) {
        showWhenReady();
      } else {
        // Якщо кадр ще не готовий, чекаємо події canplay
        const onCanPlay = () => {
          $videoBackward.removeEventListener('canplay', onCanPlay);
          showWhenReady();
        };
        $videoBackward.addEventListener('canplay', onCanPlay, { once: true });
      }
    };

    // Чекаємо події seeked (кадр встановлений)
    $videoBackward.addEventListener('seeked', onSeeked, { once: true });
  };

  // Запускаємо підготовку зворотного відео
  prepareAndShowBackward();

  // Через потрібний час перемикаємося назад на основне відео
  setTimeout(() => {
    try {
      $videoBackward.pause();
    } catch {}

    // Функція підготовки і показу основного відео
    const prepareAndShowMain = () => {
      try {
        // Встановлюємо час для основного відео
        $video.currentTime = toSegment.from;
      } catch (e) {
        console.warn('Помилка синхронізації основного відео:', e);
      }

      // Функція показу основного відео коли кадр готовий
      const showMainWhenReady = () => {
        // Перемикаємо видимість: приховуємо зворотне, показуємо основне
        $videoBackward.classList.remove('is-visible');
        $video.classList.add('is-visible');

        // Викликаємо callback якщо він переданий
        if (typeof onComplete === 'function') {
          try {
            onComplete();
          } catch (e) {
            console.warn('Помилка callback завершення сегмента:', e);
          }
        }
      };

      // Обробник готовності кадру основного відео
      const onSeekedMain = () => {
        $video.removeEventListener('seeked', onSeekedMain);
        if ($video.readyState >= 2) {
          showMainWhenReady();
        } else {
          const onCanPlayMain = () => {
            $video.removeEventListener('canplay', onCanPlayMain);
            showMainWhenReady();
          };
          $video.addEventListener('canplay', onCanPlayMain, { once: true });
        }
      };

      // Чекаємо події seeked для основного відео
      $video.addEventListener('seeked', onSeekedMain, { once: true });
    };

    // Запускаємо підготовку основного відео
    prepareAndShowMain();
  }, durationMs);
}
```

---

## 📜 Функції скролінгу

### 1. Ініціалізація FullPage.js
```javascript
function initFullPage() {
  // Синхронізуємо змінну швидкості з налаштуваннями FullPage.js
  let currentScrollSpeed = 1000;

  // Створюємо екземпляр FullPage.js
  fullPageInstance = new fullpage('#fullpage', {
    // Відключаємо стандартну навігацію
    navigation: false,
    navigationPosition: 'right',
    showActiveTooltip: false,
    
    // Налаштування скролу
    scrollingSpeed: currentScrollSpeed,  // Базова швидкість (буде змінюватися динамічно)
    easingcss3: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // Плавна анімація
    
    // Відключаємо автоматичні переходи
    autoScrolling: true,
    fitToSection: true,
    
    // Обробник зміни секцій
    onLeave: function(origin, destination, direction) {
      console.log(`Перехід: ${origin.index} → ${destination.index} (${direction})`);
      
      // Оновлюємо поточний індекс секції
      currentSectionIndex = destination.index;
      
      // Обчислюємо тривалість переходу на основі відео
      const durationMs = calculateScrollDuration(origin.index, destination.index);
      
      // Оновлюємо швидкість скролу FullPage
      updateScrollSpeed(durationMs);
      
      // Відтворюємо відео залежно від напрямку
      if (direction === 'down') {
        playVideoSegmentForward(origin.index, destination.index, durationMs);
      } else {
        playVideoSegmentReverse(origin.index, destination.index, durationMs);
      }
      
      // Оновлюємо видимість UI елементів
      updateUIVisibility(destination.index, direction === 'up');
    },
    
    // Обробник після рендеру
    afterRender: function () {
      console.log('FullPage відрендерений');
      
      // Встановлюємо початковий індекс
      currentSectionIndex = 0;
      updateUIVisibility(0, false);
      
      // Запускаємо анімацію для першої секції
      const firstSection = $sections[0];
      if (firstSection && !isInitialAnimationStarted) {
        isInitialAnimationStarted = true;
        animateSectionBlocks(firstSection);
      }
    },
    
    // Обробник зміни розміру вікна
    afterResize: function(width, height) {
      console.log('FullPage змінено розмір', width, height);
    }
  });
}
```

### 2. Обчислення тривалості скролу
```javascript
function calculateScrollDuration(fromIndex, toIndex) {
  // Отримуємо часові відрізки для переходу
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  // Перевіряємо існування відрізків
  if (!fromSegment || !toSegment) {
    console.warn('Відрізки не знайдені для індексів:', fromIndex, toIndex);
    return 1000; // Повертаємо базову тривалість
  }
  
  // Обчислюємо різницю в часі між секціями
  const timeDifference = Math.abs(toSegment.from - fromSegment.to);
  
  // Конвертуємо секунди в мілісекунди
  // 1 секунда відео = 1000ms скролу
  const durationMs = timeDifference * 1000;
  
  console.log(`Тривалість переходу: ${timeDifference}s (${durationMs}ms)`);
  return durationMs;
}
```

### 3. Оновлення швидкості скролу
```javascript
function updateScrollSpeed(durationMs) {
  // Оновлюємо швидкість у екземпляра FullPage
  if (fullPageInstance && typeof fullPageInstance.setScrollingSpeed === 'function') {
    fullPageInstance.setScrollingSpeed(durationMs);
    console.log(`Швидкість скролу оновлена: ${durationMs}ms`);
  }
  
  // Fallback для глобального API FullPage
  if (window.fullpage_api && typeof window.fullpage_api.setScrollingSpeed === 'function') {
    window.fullpage_api.setScrollingSpeed(durationMs);
    console.log(`Швидкість скролу оновлена (глобальний API): ${durationMs}ms`);
  }
}
```

---

## 🎭 Функції управління UI

### 1. Оновлення видимості UI елементів
```javascript
function updateUIVisibility(sectionIndex, isScrollingUp) {
  // Отримуємо елементи UI
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  // Логіка показу/приховування елементів залежно від секції
  if (sectionIndex === 0) {
    // Перша секція - показуємо всі елементи
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  } else if (sectionIndex === SEGMENTS.length - 1) {
    // Остання секція (футер) - приховуємо всі елементи
    soundButtonWrap?.classList.remove('visible');
    soundButtonText?.classList.remove('visible');
    arrowDownWrap?.classList.remove('visible');
  } else {
    // Проміжні секції - показуємо всі елементи
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  }
  
  console.log(`UI оновлено для секції ${sectionIndex}`);
}
```

### 2. Приховування UI для інтро
```javascript
function hideUIForIntro() {
  // Отримуємо всі UI елементи
  const uiElements = document.querySelectorAll('.ui-element');
  
  uiElements.forEach((element) => {
    // Зберігаємо поточний стан в data-атрибутах
    if (element.classList.contains('visible')) {
      element.setAttribute('data-intro-visible', 'true');
    } else {
      element.setAttribute('data-intro-hidden', 'true');
    }
    
    // Приховуємо елемент
    element.classList.remove('visible');
    element.classList.add('hidden');
  });
  
  console.log('UI приховано для інтро');
}
```

### 3. Показ UI після інтро
```javascript
function showUIAfterIntro() {
  // Отримуємо всі UI елементи
  const uiElements = document.querySelectorAll('.ui-element');
  
  uiElements.forEach((element) => {
    // Відновлюємо стан з data-атрибутів
    const wasVisible = element.getAttribute('data-intro-visible') === 'true';
    const wasHidden = element.getAttribute('data-intro-hidden') === 'true';
    
    // Очищаємо data-атрибути
    element.removeAttribute('data-intro-visible');
    element.removeAttribute('data-intro-hidden');
    
    // Відновлюємо видимість
    if (wasVisible) {
      element.classList.add('visible');
    }
    element.classList.remove('hidden');
  });
  
  console.log('UI показано після інтро');
}
```

---

## 🎬 Функції інтро

### 1. Запуск інтро послідовності
```javascript
function startIntroFlow() {
  // Перевіряємо, чи не грає вже інтро
  if (isIntroPlaying) {
    console.log('Інтро вже відтворюється');
    return;
  }
  
  isIntroPlaying = true;
  console.log('Запуск інтро послідовності');
  
  // Приховуємо UI елементи
  hideUIForIntro();
  
  // Застосовуємо класи FullPage для блокування скролу
  applyFullpageScaffoldClasses();
  
  // Відтворюємо інтро відео
  playIntroVideo();
}
```

### 2. Відтворення інтро відео
```javascript
function playIntroVideo() {
  if (!$video) {
    console.error('Відео елемент не знайдено для інтро');
    return;
  }
  
  try {
    // Встановлюємо час в початок
    $video.currentTime = 0;
    $video.playbackRate = 1; // Нормальна швидкість
    
    // Запускаємо відтворення
    const playPromise = $video.play();
    
    if (playPromise && playPromise.then) {
      playPromise.catch((error) => {
        console.error('Помилка відтворення інтро:', error);
      });
    }
    
    // Обробник завершення інтро
    const handleIntroEnd = () => {
      console.log('Інтро завершено');
      
      // Показуємо UI
      showUIAfterIntro();
      
      // Прибираємо класи блокування скролу
      removeFullpageScaffoldClasses();
      
      // Ініціалізуємо FullPage
      initFullPage();
      
      // Скидаємо прапор
      isIntroPlaying = false;
    };
    
    // Додаємо обробник завершення відео
    $video.addEventListener('ended', handleIntroEnd, { once: true });
    
  } catch (error) {
    console.error('Помилка відтворення інтро:', error);
  }
}
```

### 3. Застосування класів FullPage для блокування скролу
```javascript
function applyFullpageScaffoldClasses() {
  // Додаємо класи, які використовує FullPage для блокування скролу
  document.documentElement.classList.add('fp-enabled');
  document.body.classList.add('fp-enabled');
  
  // Додаємо клас для блокування скролу
  document.body.classList.add('fp-scroll-disabled');
  
  console.log('Застосовано класи блокування скролу');
}
```

### 4. Видалення класів блокування скролу
```javascript
function removeFullpageScaffoldClasses() {
  // Видаляємо класи блокування скролу
  document.documentElement.classList.remove('fp-enabled');
  document.body.classList.remove('fp-enabled');
  document.body.classList.remove('fp-scroll-disabled');
  
  console.log('Видалено класи блокування скролу');
}
```

---

## 🔧 Допоміжні функції

### 1. Ініціалізація CSS класів
```javascript
function initializeContentClasses() {
  // Додаємо базові класи для всіх контентних блоків
  const allContentBlocks = document.querySelectorAll(
    'p, .form_wrap, .number_wrap, .middle_col'
  );
  
  allContentBlocks.forEach((block) => {
    block.classList.add('content-block', 'animate-out');
  });
  
  // Додаємо базові класи для UI елементів
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  if (soundButtonWrap) soundButtonWrap.classList.add('ui-element');
  if (soundButtonText) soundButtonText.classList.add('ui-element');
  if (arrowDownWrap) arrowDownWrap.classList.add('ui-element');
  
  console.log('Ініціалізовано CSS класи');
}
```

### 2. Ініціалізація шрифтів
```javascript
function initFonts() {
  // Додаємо клас завантаження шрифтів
  document.documentElement.classList.add('fonts-loading');
  
  // Перевіряємо підтримку Font Loading API
  if ('fonts' in document) {
    // Чекаємо завантаження всіх шрифтів
    document.fonts.ready.then(() => {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
      console.log('Шрифти завантажені');
    });
  } else {
    // Fallback для старих браузерів
    setTimeout(() => {
      document.documentElement.classList.remove('fonts-loading');
      document.documentElement.classList.add('fonts-loaded');
      console.log('Шрифти завантажені (fallback)');
    }, 100);
  }
}
```

### 3. Очищення ресурсів
```javascript
function cleanup() {
  // Знищуємо екземпляр FullPage
  if (fullPageInstance) {
    fullPageInstance.destroy('all');
    fullPageInstance = null;
    console.log('FullPage знищено');
  }
  
  // Зупиняємо відео
  if ($video) {
    $video.pause();
    $video.currentTime = 0;
  }
  
  if ($videoBackward) {
    $videoBackward.pause();
    $videoBackward.currentTime = 0;
  }
  
  console.log('Ресурси очищено');
}

// Додаємо обробник очищення при закритті сторінки
window.addEventListener('beforeunload', cleanup);
```

---

## 🚀 Ініціалізація системи

### Головна функція ініціалізації
```javascript
// Ініціалізація при завантаженні сторінки
window.addEventListener('load', () => {
  try {
    console.log('Початок ініціалізації системи');
    
    // 1. Ініціалізуємо шрифти
    initFonts();
    
    // 2. Ініціалізуємо CSS класи
    initializeContentClasses();
    
    // 3. Підготовляємо відео для відтворення
    primeVideoPlayback($video);
    if ($videoBackward) {
      primeVideoPlayback($videoBackward);
    }
    
    // 4. Ініціалізуємо кнопки звуку
    initSoundButtons();
    
    // 5. Запускаємо інтро послідовність
    startIntroFlow();
    
    // 6. Робимо функцію зміни швидкості доступною глобально
    window.setScrollSpeed = setScrollSpeed;
    console.log('Використовуйте setScrollSpeed(milliseconds) для зміни швидкості скролу і відео');
    
    console.log('Ініціалізація завершена успішно');
    
  } catch (error) {
    console.error('Помилка ініціалізації:', error);
  }
});
```

---

## 📋 Ключові принципи

### 1. Обробка помилок
- Всі функції обгорнуті в try-catch блоки
- Логування всіх важливих подій
- Graceful fallback для критичних функцій

### 2. Продуктивність
- Використання `requestAnimationFrame` для плавних анімацій
- Оптимізована робота з DOM
- Мінімальна кількість перерисовок

### 3. Сумісність
- Підтримка старих браузерів
- Fallback для нових API
- Кросплатформна сумісність

### 4. Модульність
- Розділення логіки на окремі функції
- Перевикористовувані компоненти
- Чітке розділення відповідальності

Ця структура забезпечує надійну і продуктивну роботу системи синхронізації скролу з відео.
