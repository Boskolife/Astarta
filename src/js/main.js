const SEGMENTS = [
  [2.5, 6.83], // Сегмент 1: 2.5 - 6.83 сек
  [6.83, 11.17], // Сегмент 2: 6.83 - 11.17 сек
  [11.17, 15.5], // Сегмент 3: 11.17 - 15.5 сек
  [15.5, 19.83], // Сегмент 4: 15.5 - 19.83 сек
  [19.83, 24.17], // Сегмент 5: 19.83 - 24.17 сек
  [24.17, 28.5], // Сегмент 6: 24.17 - 28.5 сек
  [28.5, 28.5], // Сегмент 6: 24.17 - 28.5 сек
];

const LERP_ALPHA = 0.1;

const VELOCITY_BOOST = 0.12;

const SNAP_TO_FRAME = true;
const SOURCE_FPS = 120;

function primeVideoPlayback(video) {
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  const unlock = () => {
    try {
      video.muted = true;
      const p = video.play();
      if (p && p.then) {
        p.then(() => video.pause()).catch((error) => {
          console.warn('Video play error:', error);
        });
      } else {
        video.play();
        video.pause();
      }
    } catch (error) {
      console.warn('Video playback error:', error);
    }
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('click', unlock);
  };

  window.addEventListener('touchstart', unlock, { once: true, passive: true });
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
}

const $video = document.getElementById('video');
const $sections = Array.from(document.querySelectorAll('.section'));
const hud = {
  seg: document.getElementById('hud-seg'),
  prog: document.getElementById('hud-prog'),
  time: document.getElementById('hud-time'),
};

// Виртуальный скролл
let virtualScrollY = 0;
let maxVirtualScroll = 0;
let scrollVel = 0;
let smoothedTime = 0;
let activeSeg = 0;
let lastActiveSeg = -1;
let isPageVisible = true;
let animationId = null;
let isInFooterMode = false; // Флаг для режима футера

// Настройки виртуального скролла
const SCROLL_SENSITIVITY = 0.2; // Чувствительность скролла
const SCROLL_DAMPING = 0.2; // Затухание скорости
const TOTAL_SEGMENTS = SEGMENTS.length;
const MIN_SCROLL_THRESHOLD = 0.1; // Минимальный порог для начала скролла
const FOOTER_TRANSITION_HEIGHT = 100; // Высота перехода к футеру

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const invlerp = (a, b, v) => (v - a) / (b - a);

// Функция для создания анимации печати
function createTypingAnimation(element, delay = 100) {
  if (!element || element.classList.contains('typing-initialized')) {
    return;
  }

  const text = element.textContent;
  const chars = text.split('');

  // Очищаем содержимое и добавляем класс для анимации
  element.innerHTML = '';
  element.classList.add('typing-animation', 'typing-initialized');

  // Создаем span для каждой буквы
  chars.forEach((char, index) => {
    const charSpan = document.createElement('span');
    charSpan.className = 'char';
    charSpan.textContent = char; // Оставляем обычные пробелы для адаптивности
    element.appendChild(charSpan);
  });

  // Запускаем анимацию
  const charElements = element.querySelectorAll('.char');
  charElements.forEach((charEl, index) => {
    setTimeout(() => {
      charEl.classList.add('active');
    }, index * delay);
  });
}

// Функция для сброса анимации печати
function resetTypingAnimation(element) {
  if (!element || !element.classList.contains('typing-initialized')) {
    return;
  }

  element.classList.remove('typing-animation', 'typing-initialized');
  const chars = Array.from(element.querySelectorAll('.char')).map(
    (char) => char.textContent,
  );
  element.innerHTML = chars.join('');
}

function detectActiveSection() {
  // Проверяем, находимся ли мы в режиме футера
  if (virtualScrollY >= maxVirtualScroll) {
    if (!isInFooterMode) {
      isInFooterMode = true;
      // Переключаемся в режим футера
      document.body.style.overflow = 'auto';
    }
    activeSeg = TOTAL_SEGMENTS - 1; // Показываем последнюю секцию
    return;
  }

  if (isInFooterMode) {
    isInFooterMode = false;
    // Возвращаемся к режиму видео
    document.body.style.overflow = 'hidden';
  }

  // Определяем активный сегмент на основе виртуального скролла
  const scrollProgress = Math.max(
    0,
    Math.min(1, virtualScrollY / maxVirtualScroll),
  );

  // Определяем активный сегмент на основе прогресса виртуального скролла
  let idx = Math.floor(scrollProgress * TOTAL_SEGMENTS);

  // Ограничиваем индекс диапазоном сегментов
  idx = Math.max(0, Math.min(idx, TOTAL_SEGMENTS - 1));

  activeSeg = idx;
}

function updateSectionVisibility() {
  // Проверяем режим футера перед обновлением видимости
  const wasInFooterMode = isInFooterMode;
  
  // Сначала проверяем, нужно ли переключиться в режим футера
  detectActiveSection();
  
  // Обновляем видимость только если активный сегмент изменился или изменился режим футера
  if (activeSeg !== lastActiveSeg || wasInFooterMode !== isInFooterMode) {
    $sections.forEach((section, index) => {
      const segValue = parseInt(section.getAttribute('data-seg'));

      if (segValue === activeSeg) {
        // Показываем активную секцию
        section.style.opacity = '1';
        section.style.visibility = 'visible';
        section.classList.add('active');

        // Запускаем анимацию печати для серого текста в активной секции
        const grayTexts = section.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          // Сбрасываем предыдущую анимацию если была
          resetTypingAnimation(grayText);
          // Запускаем новую анимацию с небольшой задержкой
          setTimeout(() => {
            createTypingAnimation(grayText, 50); // 30ms задержка между буквами
          }, 100);
        });
      } else {
        // Скрываем неактивные секции
        section.style.opacity = '0';
        section.style.visibility = 'hidden';
        section.classList.remove('active');

        // Сбрасываем анимацию печати для неактивных секций
        const grayTexts = section.querySelectorAll('.gray_text');
        grayTexts.forEach((grayText) => {
          resetTypingAnimation(grayText);
        });
      }
    });

    // Управляем видимостью sound_button_wrap
    const soundButtonWrap = document.querySelector('.sound_button_wrap');
    if (soundButtonWrap) {
      const soundButtonText = soundButtonWrap.querySelector('p');
      
      // Приоритет: сначала проверяем режим футера
      if (isInFooterMode) {
        // В режиме футера скрываем весь элемент
        soundButtonWrap.style.opacity = '0';
        soundButtonWrap.style.visibility = 'hidden';
      } else if (activeSeg === TOTAL_SEGMENTS - 1) {
        // В последнем сегменте (но не в футере) скрываем только текст
        if (soundButtonText) {
          soundButtonText.style.opacity = '0';
          soundButtonText.style.visibility = 'hidden';
        }
        soundButtonWrap.style.opacity = '1';
        soundButtonWrap.style.visibility = 'visible';
      } else {
        // В обычных секциях показываем всё
        if (soundButtonText) {
          soundButtonText.style.opacity = '1';
          soundButtonText.style.visibility = 'visible';
        }
        soundButtonWrap.style.opacity = '1';
        soundButtonWrap.style.visibility = 'visible';
      }
    }

    lastActiveSeg = activeSeg;
  }
}

function tick() {
  // Пропускаем анимацию если страница не видна
  if (!isPageVisible) {
    animationId = requestAnimationFrame(tick);
    return;
  }

  try {
    // Применяем затухание к скорости скролла
    scrollVel *= 1 - SCROLL_DAMPING;

    // Обновляем виртуальную позицию скролла
    virtualScrollY += scrollVel;

    // Если мы в режиме футера, разрешаем скролл дальше
    if (isInFooterMode) {
      // В режиме футера не ограничиваем скролл
      virtualScrollY = Math.max(virtualScrollY, maxVirtualScroll);
    } else {
      // В обычном режиме ограничиваем скролл
      virtualScrollY = clamp(virtualScrollY, 0, maxVirtualScroll);
    }

    detectActiveSection();
    updateSectionVisibility();

    // В режиме футера не управляем скроллом программно
    if (!isInFooterMode) {
      window.scrollTo(0, 0);
    }

    // Вычисляем время видео только если не в режиме футера
    if (!isInFooterMode) {
      const scrollProgress = Math.max(
        0,
        Math.min(1, virtualScrollY / maxVirtualScroll),
      );

      // Определяем локальный прогресс внутри текущего сегмента
      const segmentProgress = (scrollProgress * TOTAL_SEGMENTS) % 1;

      const [t0, t1] = SEGMENTS[activeSeg];
      let targetTime = lerp(t0, t1, segmentProgress);

      if (VELOCITY_BOOST !== 0) {
        const segLen = Math.abs(t1 - t0) || 0.001;
        const dir = Math.sign(scrollVel);
        targetTime +=
          dir *
          Math.min(Math.abs(scrollVel) / 1000, 1) *
          segLen *
          VELOCITY_BOOST;
        targetTime = clamp(targetTime, Math.min(t0, t1), Math.max(t0, t1));
      }

      smoothedTime = lerp(smoothedTime || t0, targetTime, LERP_ALPHA);

      if (SNAP_TO_FRAME && SOURCE_FPS > 0) {
        const step = 1 / SOURCE_FPS;
        smoothedTime = Math.round(smoothedTime / step) * step;
      }

      if ($video && $video.readyState >= 2) {
        if (!$video.seeking) {
          $video.currentTime = smoothedTime;
        }
      }

      if (hud.seg) hud.seg.textContent = String(activeSeg);
      if (hud.prog) hud.prog.textContent = segmentProgress.toFixed(2);
      if (hud.time) hud.time.textContent = smoothedTime.toFixed(2);
    }
  } catch (error) {
    console.warn('Animation tick error:', error);
  }

  animationId = requestAnimationFrame(tick);
}

function loadVideo() {
  if ($video && $video.readyState < 2) {
    $video.load();
  }
}

// Обработчики виртуального скролла
function handleWheel(event) {
  // Если мы в режиме футера, разрешаем стандартный скролл
  if (isInFooterMode) {
    return;
  }

  event.preventDefault();

  // Получаем дельту скролла
  const delta = event.deltaY;

  // Применяем чувствительность только если дельта больше порога
  if (Math.abs(delta) > MIN_SCROLL_THRESHOLD) {
    scrollVel += delta * SCROLL_SENSITIVITY;

    // Ограничиваем максимальную скорость
    scrollVel = clamp(scrollVel, -40, 40);
  }
}

// Тач-события для мобильных устройств
let touchStartY = 0;
let touchStartTime = 0;
let lastTouchY = 0;
let touchVelocity = 0;

function handleTouchStart(event) {
  touchStartY = event.touches[0].clientY;
  lastTouchY = touchStartY;
  touchStartTime = Date.now();
  touchVelocity = 0;
}

function handleTouchMove(event) {
  // Если мы в режиме футера, разрешаем стандартный скролл
  if (isInFooterMode) {
    return;
  }

  event.preventDefault();

  const touchY = event.touches[0].clientY;
  const deltaY = lastTouchY - touchY;
  const currentTime = Date.now();
  const timeDelta = currentTime - touchStartTime;

  // Вычисляем скорость тача
  if (timeDelta > 0) {
    touchVelocity = deltaY / timeDelta;
  }

  // Применяем чувствительность к тач-событиям
  scrollVel += deltaY * SCROLL_SENSITIVITY * 0.3;

  lastTouchY = touchY;
}

function handleTouchEnd(event) {
  // Добавляем инерцию на основе скорости свайпа
  const touchEndTime = Date.now();
  const touchDuration = touchEndTime - touchStartTime;

  if (touchDuration < 200 && Math.abs(touchVelocity) > 0.5) {
    // Быстрый свайп - добавляем инерцию
    scrollVel += touchVelocity * 100;
  }

  // Ограничиваем максимальную скорость
  scrollVel = clamp(scrollVel, -30, 30);
}

$video.addEventListener('loadedmetadata', () => {
  const dur = $video.duration || 0;
  for (let i = 0; i < SEGMENTS.length; i++) {
    SEGMENTS[i][0] = clamp(SEGMENTS[i][0], 0, dur);
    SEGMENTS[i][1] = clamp(SEGMENTS[i][1], 0, dur);
  }
  smoothedTime = SEGMENTS[0][0] || 0;

  // Устанавливаем максимальный виртуальный скролл
  maxVirtualScroll = window.innerHeight * TOTAL_SEGMENTS;
});

// Добавляем обработчики событий для виртуального скролла
document.addEventListener('wheel', handleWheel, { passive: false });
document.addEventListener('touchstart', handleTouchStart, { passive: true });
document.addEventListener('touchmove', handleTouchMove, { passive: false });
document.addEventListener('touchend', handleTouchEnd, { passive: true });

// Обработчик для переключения обратно к видео при скролле вверх в футере
document.addEventListener(
  'scroll',
  () => {
    if (isInFooterMode && window.scrollY <= 0) {
      isInFooterMode = false;
      virtualScrollY = maxVirtualScroll - 1;
      document.body.style.overflow = 'hidden';
      window.scrollTo(0, 0);
      
      // Обновляем видимость элементов интерфейса
      updateSectionVisibility();
    }
  },
  { passive: true },
);

// Функция для скролла к секции с формой
function scrollToForm() {
  // Находим секцию с формой (data-seg="6" - последняя секция)
  const formSection = document.querySelector('[data-seg="6"]');
  if (formSection) {
    // Создаем плавную анимацию скролла к форме
    // Устанавливаем цель чуть раньше конца, чтобы можно было скроллить дальше
    const targetScroll = maxVirtualScroll - window.innerHeight * 0.5;
    const startScroll = virtualScrollY;
    const duration = 1000; // 1 секунда анимации
    const startTime = performance.now();

    function animateScroll(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Используем easeInOutCubic для плавной анимации
      const easeInOutCubic =
        progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      virtualScrollY =
        startScroll + (targetScroll - startScroll) * easeInOutCubic;

      if (progress < 1) {
        requestAnimationFrame(animateScroll);
      } else {
        // Финальная позиция - не в самом конце, чтобы можно было скроллить дальше
        virtualScrollY = targetScroll;
        activeSeg = 6; // Последний сегмент (индекс 6 для 7 сегментов 0-6)
      }

      // Обновляем видимость секций во время анимации
      updateSectionVisibility();
    }

    requestAnimationFrame(animateScroll);
  }
}

// Обработчик клика на кнопку в хедере
function handleHeaderButtonClick(event) {
  const target = event.target.closest('a[href="#form"]');
  if (target) {
    event.preventDefault();
    scrollToForm();
  }
}

// Обработчики для загрузки видео
document.addEventListener('click', loadVideo, { once: true });
document.addEventListener('touchstart', loadVideo, {
  once: true,
  passive: true,
});

// Добавляем обработчик для кнопки в хедере
document.addEventListener('click', handleHeaderButtonClick);

document.addEventListener('visibilitychange', () => {
  isPageVisible = !document.hidden;
});

function cleanup() {
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // Удаляем обработчики событий
  document.removeEventListener('wheel', handleWheel);
  document.removeEventListener('touchstart', handleTouchStart);
  document.removeEventListener('touchmove', handleTouchMove);
  document.removeEventListener('touchend', handleTouchEnd);
  document.removeEventListener('click', handleHeaderButtonClick);
}

window.addEventListener('beforeunload', cleanup);

function initSoundButtons() {
  const soundButtons = document.querySelectorAll('.toggle-sound');
  let isSoundOn = false;

  soundButtons.forEach((button) => {
    button.addEventListener('click', () => {
      isSoundOn = !isSoundOn;
      const span = button.querySelector('span');
      if (span) {
        span.textContent = isSoundOn ? 'Sound Off' : 'Sound On';
      }

      if ($video) {
        $video.muted = !isSoundOn;
      }
    });
  });
}

window.addEventListener('load', () => {
  try {
    primeVideoPlayback($video);
    initSoundButtons();

    // Инициализируем виртуальный скролл
    maxVirtualScroll = window.innerHeight * TOTAL_SEGMENTS;
    virtualScrollY = 0;
    activeSeg = 0;
    updateSectionVisibility();

    animationId = requestAnimationFrame(tick);
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
