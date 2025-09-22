# 🎬 Логіка скролінгу та відео - Детальна інструкція

## 📋 Зміст
1. [Огляд системи](#огляд-системи)
2. [Структура даних](#структура-даних)
3. [Основні компоненти](#основні-компоненти)
4. [Логіка скролінгу](#логіка-скролінгу)
5. [Система відео](#система-відео)
6. [Зворотне відтворення](#зворотне-відтворення)
7. [Синхронізація](#синхронізація)
8. [Повний код з коментарями](#повний-код-з-коментарями)

---

## 🎯 Огляд системи

### Принцип роботи:
1. **Користувач скролить** → FullPage.js перемикає секції
2. **Секція змінюється** → JavaScript обчислює час відео
3. **Час обчислено** → Відео відтворюється з потрібною швидкістю
4. **Скрол назад** → Перемикання на зворотне відео

### Ключові особливості:
- ✅ Синхронізація скролу з відео
- ✅ Плавні переходи між секціями
- ✅ Зворотне відтворення
- ✅ Адаптивна швидкість скролу
- ✅ Підтримка мобільних пристроїв

---

## 📊 Структура даних

### 1. SEGMENTS (секції HTML)
```javascript
const SEGMENTS = [
  { from: 0, to: 5 },      // Секція 0: Інтро (0-5 сек)
  { from: 5, to: 10 },     // Секція 1: Перша секція (5-10 сек)
  { from: 10, to: 15 },    // Секція 2: Друга секція (10-15 сек)
  { from: 15, to: 20 },    // Секція 3: Третя секція (15-20 сек)
  { from: 20, to: 25 },    // Секція 4: Четверта секція (20-25 сек)
  { from: 25, to: 30 },    // Секція 5: П'ята секція (25-30 сек)
  { from: 30, to: 35 },    // Секція 6: Форма (30-35 сек)
  { from: 35, to: 40 }     // Секція 7: Футер (35-40 сек)
];
```

**Призначення:** Визначає, коли яка HTML секція повинна бути видимою.

### 2. VIDEO_SEGMENTS (сегменти відео)
```javascript
const VIDEO_SEGMENTS = [
  { from: 0, to: 5 },      // Інтро відео
  { from: 5, to: 10 },     // Перехід 1
  { from: 10, to: 15 },    // Перехід 2
  { from: 15, to: 20 },    // Перехід 3
  { from: 20, to: 25 },    // Перехід 4
  { from: 25, to: 30 },    // Перехід 5
  { from: 30, to: 35 },    // Перехід 6
  { from: 35, to: 40 }     // Перехід 7
];
```

**Призначення:** Визначає часові відрізки відео для кожного переходу.

### 3. Константи
```javascript
const TIME_WRITE_EPSILON = 1 / 120; // Мінімальний поріг оновлення currentTime
```

---

## 🧩 Основні компоненти

### 1. DOM елементи
```javascript
const $video = document.getElementById('video');           // Основне відео
const $videoBackward = document.getElementById('video-backward'); // Зворотне відео
const $sections = document.querySelectorAll('.section');   // HTML секції
let fullPageInstance = null;                              // Екземпляр FullPage.js
```

### 2. Стан системи
```javascript
let currentSectionIndex = 0;        // Поточний індекс секції
let isInitialAnimationStarted = false; // Прапор початкової анімації
let isIntroPlaying = false;         // Прапор відтворення інтро
```

---

## 📜 Логіка скролінгу

### 1. Ініціалізація FullPage.js
```javascript
function initFullPage() {
  fullPageInstance = new fullpage('#fullpage', {
    // Відключаємо стандартну навігацію
    navigation: false,
    navigationPosition: 'right',
    showActiveTooltip: false,
    
    // Налаштування скролу
    scrollingSpeed: 1000, // Базова швидкість (буде змінюватися динамічно)
    easingcss3: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    
    // Відключаємо автоматичні переходи
    autoScrolling: true,
    fitToSection: true,
    
    // Обробники подій
    onLeave: function(origin, destination, direction) {
      handleSectionChange(origin.index, destination.index, direction);
    },
    
    afterRender: function() {
      // Ініціалізація після рендеру
      currentSectionIndex = 0;
      updateUIVisibility(0, false);
    }
  });
}
```

### 2. Обробка зміни секцій
```javascript
function handleSectionChange(originIndex, destinationIndex, direction) {
  console.log(`Перехід: ${originIndex} → ${destinationIndex} (${direction})`);
  
  // Оновлюємо поточний індекс
  currentSectionIndex = destinationIndex;
  
  // Обчислюємо тривалість переходу
  const durationMs = calculateScrollDuration(originIndex, destinationIndex);
  
  // Оновлюємо швидкість FullPage
  updateScrollSpeed(durationMs);
  
  // Відтворюємо відео
  if (direction === 'down') {
    playVideoSegmentForward(originIndex, destinationIndex, durationMs);
  } else {
    playVideoSegmentReverse(originIndex, destinationIndex, durationMs);
  }
  
  // Оновлюємо видимість UI
  updateUIVisibility(destinationIndex, direction === 'up');
}
```

### 3. Обчислення тривалості скролу
```javascript
function calculateScrollDuration(fromIndex, toIndex) {
  // Отримуємо часові відрізки
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return 1000;
  
  // Обчислюємо різницю в часі
  const timeDifference = Math.abs(toSegment.from - fromSegment.to);
  
  // Конвертуємо в мілісекунди (1 секунда відео = 1000ms скролу)
  return timeDifference * 1000;
}
```

### 4. Оновлення швидкості скролу
```javascript
function updateScrollSpeed(durationMs) {
  // Оновлюємо швидкість у FullPage
  if (fullPageInstance && typeof fullPageInstance.setScrollingSpeed === 'function') {
    fullPageInstance.setScrollingSpeed(durationMs);
  }
  
  // Fallback для глобального API
  if (window.fullpage_api && typeof window.fullpage_api.setScrollingSpeed === 'function') {
    window.fullpage_api.setScrollingSpeed(durationMs);
  }
}
```

---

## 🎬 Система відео

### 1. Пряме відтворення
```javascript
function playVideoSegmentForward(fromIndex, toIndex, durationMs) {
  if (!$video) return;
  
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;
  
  try {
    // Зупиняємо відео
    $video.pause();
    
    // Встановлюємо початковий час
    $video.currentTime = fromSegment.to;
    
    // Обчислюємо швидкість відтворення
    const timeToPlay = toSegment.from - fromSegment.to;
    const playbackRate = timeToPlay / (durationMs / 1000);
    
    // Встановлюємо швидкість і запускаємо
    $video.playbackRate = playbackRate;
    $video.play();
    
    // Зупиняємо через потрібний час
    setTimeout(() => {
      $video.pause();
      $video.currentTime = toSegment.from;
      $video.playbackRate = 1;
    }, durationMs);
    
  } catch (error) {
    console.error('Помилка відтворення відео:', error);
  }
}
```

### 2. Зворотне відтворення
```javascript
function playVideoSegmentReverse(fromIndex, toIndex, durationMs) {
  if (!$video || !$videoBackward) return;
  
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;
  
  try {
    // Зупиняємо обидва відео
    $video.pause();
    $videoBackward.pause();
    
    // Обчислюємо час для зворотного відео
    const videoDuration = $video.duration || 0;
    const backwardFromTime = videoDuration - fromSegment.to;
    const backwardToTime = videoDuration - toSegment.from;
    
    // Підготовляємо зворотне відео
    const prepareAndShowBackward = () => {
      try {
        $videoBackward.currentTime = backwardFromTime;
      } catch (e) {
        console.warn('Помилка встановлення часу зворотного відео:', e);
      }
      
      // Показуємо зворотне відео коли кадр готовий
      const showWhenReady = () => {
        $video.classList.remove('is-visible');
        $videoBackward.classList.add('is-visible');
        
        const playPromise = $videoBackward.play();
        if (playPromise && playPromise.then) {
          playPromise.catch((e) => console.warn('Помилка відтворення зворотного відео:', e));
        }
      };
      
      // Чекаємо готовності кадру
      const onSeeked = () => {
        $videoBackward.removeEventListener('seeked', onSeeked);
        if ($videoBackward.readyState >= 2) {
          showWhenReady();
        } else {
          const onCanPlay = () => {
            $videoBackward.removeEventListener('canplay', onCanPlay);
            showWhenReady();
          };
          $videoBackward.addEventListener('canplay', onCanPlay, { once: true });
        }
      };
      
      $videoBackward.addEventListener('seeked', onSeeked, { once: true });
    };
    
    prepareAndShowBackward();
    
    // Перемикаємося назад на основне відео
    setTimeout(() => {
      try {
        $videoBackward.pause();
      } catch {}
      
      const prepareAndShowMain = () => {
        try {
          $video.currentTime = toSegment.from;
        } catch (e) {
          console.warn('Помилка синхронізації основного відео:', e);
        }
        
        const showMainWhenReady = () => {
          $videoBackward.classList.remove('is-visible');
          $video.classList.add('is-visible');
        };
        
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
        
        $video.addEventListener('seeked', onSeekedMain, { once: true });
      };
      
      prepareAndShowMain();
    }, durationMs);
    
  } catch (error) {
    console.error('Помилка зворотного відтворення:', error);
  }
}
```

---

## 🔄 Зворотне відтворення

### Принцип роботи:
1. **Створюється окремий відеофайл** `backward.mp4` зі зворотним відтворенням
2. **При скролі назад** перемикаємося на зворотне відео
3. **Обчислюємо час** для зворотного відео (duration - originalTime)
4. **Плавно перемикаємося** між основним і зворотним відео

### Створення зворотного відео (FFmpeg):
```bash
# Для десктопу
ffmpeg -i output.mp4 -vf reverse -af areverse backward.mp4

# Для мобільної версії
ffmpeg -i output_mob.mp4 -vf reverse -af areverse backward_mob.mp4
```

### HTML структура:
```html
<div class="video-stack" role="presentation" aria-hidden="true">
  <video id="video" class="video is-visible" playsinline muted preload="auto">
    <source src="./video/output-zipped.mp4" media="(min-width: 479px)" type="video/mp4">
    <source src="./video/output_mob.mp4" media="(max-width: 480px)" type="video/mp4">
  </video>
  <video id="video-backward" class="video video-backward" playsinline muted preload="auto">
    <source src="./video/backward.mp4" media="(min-width: 479px)" type="video/mp4">
    <source src="./video/backward_mob.mp4" media="(max-width: 480px)" type="video/mp4">
  </video>
</div>
```

### CSS для перемикання:
```scss
.video-stack {
  position: fixed;
  inset: 0;
  z-index: -1;
}

.video-stack .video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  will-change: opacity;
}

.video-stack .video.is-visible {
  opacity: 1;
}
```

---

## ⚙️ Синхронізація

### 1. Часові мітки
- **SEGMENTS**: Визначають видимість HTML секцій
- **VIDEO_SEGMENTS**: Визначають відтворення відео
- **Синхронізація**: Обидва масиви повинні бути синхронізовані

### 2. Обчислення часу
```javascript
// Час переходу = різниця між кінцевим часом попередньої секції 
// і початковим часом наступної секції
const timeDifference = Math.abs(toSegment.from - fromSegment.to);

// Тривалість скролу = час переходу * 1000ms
const durationMs = timeDifference * 1000;
```

### 3. Швидкість відтворення
```javascript
// Швидкість = час відео / час скролу
const playbackRate = timeToPlay / (durationMs / 1000);
```

---

## 🚀 Повний код з коментарями

### Основні функції:

#### 1. Ініціалізація системи
```javascript
// Ініціалізація при завантаженні сторінки
window.addEventListener('load', () => {
  try {
    // Ініціалізуємо шрифти
    initFonts();
    
    // Ініціалізуємо CSS класи
    initializeContentClasses();
    
    // Підготовляємо відео для відтворення
    primeVideoPlayback($video);
    if ($videoBackward) {
      primeVideoPlayback($videoBackward);
    }
    
    // Ініціалізуємо кнопки звуку
    initSoundButtons();
    
    // Запускаємо інтро послідовність
    startIntroFlow();
    
  } catch (error) {
    console.error('Помилка ініціалізації:', error);
  }
});
```

#### 2. Підготовка відео
```javascript
function primeVideoPlayback(video) {
  if (!video) {
    console.warn('Відео елемент не знайдено');
    return;
  }

  // Встановлюємо базові властивості
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  
  // Обробник для першої взаємодії користувача
  const handleFirstInteraction = () => {
    video.muted = false;
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
  };
  
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('touchstart', handleFirstInteraction);
}
```

#### 3. Інтро послідовність
```javascript
function startIntroFlow() {
  if (isIntroPlaying) return;
  
  isIntroPlaying = true;
  
  // Приховуємо UI для інтро
  hideUIForIntro();
  
  // Застосовуємо класи FullPage для блокування скролу
  applyFullpageScaffoldClasses();
  
  // Відтворюємо інтро
  playIntroVideo();
}

function playIntroVideo() {
  if (!$video) return;
  
  try {
    $video.currentTime = 0;
    $video.playbackRate = 1;
    $video.play();
    
    // Після завершення інтро
    $video.addEventListener('ended', () => {
      showUIAfterIntro();
      removeFullpageScaffoldClasses();
      initFullPage();
    }, { once: true });
    
  } catch (error) {
    console.error('Помилка відтворення інтро:', error);
  }
}
```

#### 4. Управління UI
```javascript
function updateUIVisibility(sectionIndex, isScrollingUp) {
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  // Показуємо/приховуємо елементи залежно від секції
  if (sectionIndex === 0) {
    // Перша секція - показуємо все
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  } else if (sectionIndex === SEGMENTS.length - 1) {
    // Остання секція (футер) - приховуємо все
    soundButtonWrap?.classList.remove('visible');
    soundButtonText?.classList.remove('visible');
    arrowDownWrap?.classList.remove('visible');
  } else {
    // Проміжні секції
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  }
}
```

---

## 📝 Чек-лист для реалізації

### 1. Підготовка відео
- [ ] Створити основне відео
- [ ] Створити зворотне відео (FFmpeg)
- [ ] Створити мобільні версії
- [ ] Оптимізувати розмір файлів

### 2. Налаштування даних
- [ ] Визначити SEGMENTS (часові мітки секцій)
- [ ] Визначити VIDEO_SEGMENTS (часові мітки відео)
- [ ] Синхронізувати обидва масиви
- [ ] Протестувати на різних пристроях

### 3. HTML структура
- [ ] Створити video-stack контейнер
- [ ] Додати основні відео елементи
- [ ] Додати source теги для адаптивності
- [ ] Налаштувати accessibility атрибути

### 4. CSS стилі
- [ ] Налаштувати video-stack позиціонування
- [ ] Додати is-visible класи
- [ ] Налаштувати плавні переходи
- [ ] Оптимізувати для продуктивності

### 5. JavaScript логіка
- [ ] Ініціалізувати FullPage.js
- [ ] Налаштувати обробники подій
- [ ] Реалізувати пряме відтворення
- [ ] Реалізувати зворотне відтворення
- [ ] Додати обробку помилок

### 6. Тестування
- [ ] Перевірити на різних браузерах
- [ ] Протестувати на мобільних пристроях
- [ ] Перевірити продуктивність
- [ ] Протестувати зворотне відтворення

---

## 🎯 Ключові принципи

1. **Синхронізація**: SEGMENTS і VIDEO_SEGMENTS повинні бути синхронізовані
2. **Продуктивність**: Використовуйте preload і оптимізовані відео
3. **Обробка помилок**: Завжди додавайте try-catch блоки
4. **Адаптивність**: Підтримуйте мобільні пристрої
5. **Доступність**: Додавайте aria-labels і ролі
6. **Тестування**: Перевіряйте на різних пристроях і браузерах

---

## 🔧 Налаштування для нового проекту

1. **Скопіюйте структуру даних** (SEGMENTS, VIDEO_SEGMENTS)
2. **Адаптуйте часові мітки** під ваше відео
3. **Налаштуйте HTML структуру** під ваш дизайн
4. **Створіть зворотні відео** за допомогою FFmpeg
5. **Протестуйте синхронізацію** на різних пристроях

Ця система забезпечує плавну синхронізацію скролу з відео і може бути адаптована для будь-яких проектів з подібною функціональністю.
