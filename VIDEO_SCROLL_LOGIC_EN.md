# 🎬 Video Scroll Logic - Detailed Guide

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [Data Structure](#data-structure)
3. [Core Components](#core-components)
4. [Scroll Logic](#scroll-logic)
5. [Video System](#video-system)
6. [Reverse Playback](#reverse-playback)
7. [Synchronization](#synchronization)
8. [Complete Code with Comments](#complete-code-with-comments)

---

## 🎯 System Overview

### How it works:
1. **User scrolls** → FullPage.js switches sections
2. **Section changes** → JavaScript calculates video time
3. **Time calculated** → Video plays at required speed
4. **Scroll backward** → Switch to reverse video

### Key Features:
- ✅ Scroll synchronization with video
- ✅ Smooth transitions between sections
- ✅ Reverse playback
- ✅ Adaptive scroll speed
- ✅ Mobile device support

---

## 📊 Data Structure

### 1. SEGMENTS (HTML sections)
```javascript
const SEGMENTS = [
  { from: 0, to: 5 },      // Section 0: Intro (0-5 sec)
  { from: 5, to: 10 },     // Section 1: First section (5-10 sec)
  { from: 10, to: 15 },    // Section 2: Second section (10-15 sec)
  { from: 15, to: 20 },    // Section 3: Third section (15-20 sec)
  { from: 20, to: 25 },    // Section 4: Fourth section (20-25 sec)
  { from: 25, to: 30 },    // Section 5: Fifth section (25-30 sec)
  { from: 30, to: 35 },    // Section 6: Form (30-35 sec)
  { from: 35, to: 40 }     // Section 7: Footer (35-40 sec)
];
```

**Purpose:** Defines when which HTML section should be visible.

### 2. VIDEO_SEGMENTS (video segments)
```javascript
const VIDEO_SEGMENTS = [
  { from: 0, to: 5 },      // Intro video
  { from: 5, to: 10 },     // Transition 1
  { from: 10, to: 15 },    // Transition 2
  { from: 15, to: 20 },    // Transition 3
  { from: 20, to: 25 },    // Transition 4
  { from: 25, to: 30 },    // Transition 5
  { from: 30, to: 35 },    // Transition 6
  { from: 35, to: 40 }     // Transition 7
];
```

**Purpose:** Defines video time segments for each transition.

### 3. Constants
```javascript
const TIME_WRITE_EPSILON = 1 / 120; // Minimum threshold for currentTime updates
```

---

## 🧩 Core Components

### 1. DOM Elements
```javascript
const $video = document.getElementById('video');           // Main video
const $videoBackward = document.getElementById('video-backward'); // Reverse video
const $sections = document.querySelectorAll('.section');   // HTML sections
let fullPageInstance = null;                              // FullPage.js instance
```

### 2. System State
```javascript
let currentSectionIndex = 0;        // Current section index
let isInitialAnimationStarted = false; // Initial animation flag
let isIntroPlaying = false;         // Intro playback flag
```

---

## 📜 Scroll Logic

### 1. FullPage.js Initialization
```javascript
function initFullPage() {
  fullPageInstance = new fullpage('#fullpage', {
    // Disable standard navigation
    navigation: false,
    navigationPosition: 'right',
    showActiveTooltip: false,
    
    // Scroll settings
    scrollingSpeed: 1000, // Base speed (will change dynamically)
    easingcss3: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
    
    // Disable automatic transitions
    autoScrolling: true,
    fitToSection: true,
    
    // Event handlers
    onLeave: function(origin, destination, direction) {
      handleSectionChange(origin.index, destination.index, direction);
    },
    
    afterRender: function() {
      // Initialization after render
      currentSectionIndex = 0;
      updateUIVisibility(0, false);
    }
  });
}
```

### 2. Section Change Handling
```javascript
function handleSectionChange(originIndex, destinationIndex, direction) {
  console.log(`Transition: ${originIndex} → ${destinationIndex} (${direction})`);
  
  // Update current index
  currentSectionIndex = destinationIndex;
  
  // Calculate transition duration
  const durationMs = calculateScrollDuration(originIndex, destinationIndex);
  
  // Update FullPage speed
  updateScrollSpeed(durationMs);
  
  // Play video
  if (direction === 'down') {
    playVideoSegmentForward(originIndex, destinationIndex, durationMs);
  } else {
    playVideoSegmentReverse(originIndex, destinationIndex, durationMs);
  }
  
  // Update UI visibility
  updateUIVisibility(destinationIndex, direction === 'up');
}
```

### 3. Scroll Duration Calculation
```javascript
function calculateScrollDuration(fromIndex, toIndex) {
  // Get time segments
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return 1000;
  
  // Calculate time difference
  const timeDifference = Math.abs(toSegment.from - fromSegment.to);
  
  // Convert to milliseconds (1 second video = 1000ms scroll)
  return timeDifference * 1000;
}
```

### 4. Scroll Speed Update
```javascript
function updateScrollSpeed(durationMs) {
  // Update FullPage speed
  if (fullPageInstance && typeof fullPageInstance.setScrollingSpeed === 'function') {
    fullPageInstance.setScrollingSpeed(durationMs);
  }
  
  // Fallback for global API
  if (window.fullpage_api && typeof window.fullpage_api.setScrollingSpeed === 'function') {
    window.fullpage_api.setScrollingSpeed(durationMs);
  }
}
```

---

## 🎬 Video System

### 1. Forward Playback
```javascript
function playVideoSegmentForward(fromIndex, toIndex, durationMs) {
  if (!$video) return;
  
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;
  
  try {
    // Stop video
    $video.pause();
    
    // Set start time
    $video.currentTime = fromSegment.to;
    
    // Calculate playback speed
    const timeToPlay = toSegment.from - fromSegment.to;
    const playbackRate = timeToPlay / (durationMs / 1000);
    
    // Set speed and start
    $video.playbackRate = playbackRate;
    $video.play();
    
    // Stop after required time
    setTimeout(() => {
      $video.pause();
      $video.currentTime = toSegment.from;
      $video.playbackRate = 1;
    }, durationMs);
    
  } catch (error) {
    console.error('Video playback error:', error);
  }
}
```

### 2. Reverse Playback
```javascript
function playVideoSegmentReverse(fromIndex, toIndex, durationMs) {
  if (!$video || !$videoBackward) return;
  
  const fromSegment = VIDEO_SEGMENTS[fromIndex];
  const toSegment = VIDEO_SEGMENTS[toIndex];
  
  if (!fromSegment || !toSegment) return;
  
  try {
    // Stop both videos
    $video.pause();
    $videoBackward.pause();
    
    // Calculate time for reverse video
    const videoDuration = $video.duration || 0;
    const backwardFromTime = videoDuration - fromSegment.to;
    const backwardToTime = videoDuration - toSegment.from;
    
    // Prepare reverse video
    const prepareAndShowBackward = () => {
      try {
        $videoBackward.currentTime = backwardFromTime;
      } catch (e) {
        console.warn('Failed to set backward video time:', e);
      }
      
      // Show reverse video when frame is ready
      const showWhenReady = () => {
        $video.classList.remove('is-visible');
        $videoBackward.classList.add('is-visible');
        
        const playPromise = $videoBackward.play();
        if (playPromise && playPromise.then) {
          playPromise.catch((e) => console.warn('Backward video play error:', e));
        }
      };
      
      // Wait for frame readiness
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
    
    // Switch back to main video
    setTimeout(() => {
      try {
        $videoBackward.pause();
      } catch {}
      
      const prepareAndShowMain = () => {
        try {
          $video.currentTime = toSegment.from;
        } catch (e) {
          console.warn('Failed to sync main video time:', e);
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
    console.error('Reverse playback error:', error);
  }
}
```

---

## 🔄 Reverse Playback

### How it works:
1. **Create separate video file** `backward.mp4` with reverse playback
2. **On backward scroll** switch to reverse video
3. **Calculate time** for reverse video (duration - originalTime)
4. **Smoothly switch** between main and reverse video

### Creating reverse video (FFmpeg):
```bash
# For desktop
ffmpeg -i output.mp4 -vf reverse -af areverse backward.mp4

# For mobile version
ffmpeg -i output_mob.mp4 -vf reverse -af areverse backward_mob.mp4
```

### HTML structure:
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

### CSS for switching:
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

## ⚙️ Synchronization

### 1. Time stamps
- **SEGMENTS**: Define HTML section visibility
- **VIDEO_SEGMENTS**: Define video playback
- **Synchronization**: Both arrays must be synchronized

### 2. Time calculation
```javascript
// Transition time = difference between end time of previous section 
// and start time of next section
const timeDifference = Math.abs(toSegment.from - fromSegment.to);

// Scroll duration = transition time * 1000ms
const durationMs = timeDifference * 1000;
```

### 3. Playback speed
```javascript
// Speed = video time / scroll time
const playbackRate = timeToPlay / (durationMs / 1000);
```

---

## 🚀 Complete Code with Comments

### Core functions:

#### 1. System initialization
```javascript
// Initialization on page load
window.addEventListener('load', () => {
  try {
    // Initialize fonts
    initFonts();
    
    // Initialize CSS classes
    initializeContentClasses();
    
    // Prepare videos for playback
    primeVideoPlayback($video);
    if ($videoBackward) {
      primeVideoPlayback($videoBackward);
    }
    
    // Initialize sound buttons
    initSoundButtons();
    
    // Start intro sequence
    startIntroFlow();
    
  } catch (error) {
    console.error('Initialization error:', error);
  }
});
```

#### 2. Video preparation
```javascript
function primeVideoPlayback(video) {
  if (!video) {
    console.warn('Video element not found');
    return;
  }

  // Set basic properties
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  
  // Handler for first user interaction
  const handleFirstInteraction = () => {
    video.muted = false;
    document.removeEventListener('click', handleFirstInteraction);
    document.removeEventListener('touchstart', handleFirstInteraction);
  };
  
  document.addEventListener('click', handleFirstInteraction);
  document.addEventListener('touchstart', handleFirstInteraction);
}
```

#### 3. Intro sequence
```javascript
function startIntroFlow() {
  if (isIntroPlaying) return;
  
  isIntroPlaying = true;
  
  // Hide UI for intro
  hideUIForIntro();
  
  // Apply FullPage classes for scroll blocking
  applyFullpageScaffoldClasses();
  
  // Play intro
  playIntroVideo();
}

function playIntroVideo() {
  if (!$video) return;
  
  try {
    $video.currentTime = 0;
    $video.playbackRate = 1;
    $video.play();
    
    // After intro completion
    $video.addEventListener('ended', () => {
      showUIAfterIntro();
      removeFullpageScaffoldClasses();
      initFullPage();
    }, { once: true });
    
  } catch (error) {
    console.error('Intro playback error:', error);
  }
}
```

#### 4. UI management
```javascript
function updateUIVisibility(sectionIndex, isScrollingUp) {
  const soundButtonWrap = document.querySelector('.sound_button_wrap');
  const soundButtonText = soundButtonWrap?.querySelector('p');
  const arrowDownWrap = document.querySelector('.arrow_down_wrap');
  
  // Show/hide elements based on section
  if (sectionIndex === 0) {
    // First section - show all
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  } else if (sectionIndex === SEGMENTS.length - 1) {
    // Last section (footer) - hide all
    soundButtonWrap?.classList.remove('visible');
    soundButtonText?.classList.remove('visible');
    arrowDownWrap?.classList.remove('visible');
  } else {
    // Intermediate sections
    soundButtonWrap?.classList.add('visible');
    soundButtonText?.classList.add('visible');
    arrowDownWrap?.classList.add('visible');
  }
}
```

---

## 📝 Implementation Checklist

### 1. Video preparation
- [ ] Create main video
- [ ] Create reverse video (FFmpeg)
- [ ] Create mobile versions
- [ ] Optimize file sizes

### 2. Data setup
- [ ] Define SEGMENTS (section time stamps)
- [ ] Define VIDEO_SEGMENTS (video time stamps)
- [ ] Synchronize both arrays
- [ ] Test on different devices

### 3. HTML structure
- [ ] Create video-stack container
- [ ] Add main video elements
- [ ] Add source tags for responsiveness
- [ ] Configure accessibility attributes

### 4. CSS styles
- [ ] Configure video-stack positioning
- [ ] Add is-visible classes
- [ ] Configure smooth transitions
- [ ] Optimize for performance

### 5. JavaScript logic
- [ ] Initialize FullPage.js
- [ ] Configure event handlers
- [ ] Implement forward playback
- [ ] Implement reverse playback
- [ ] Add error handling

### 6. Testing
- [ ] Test on different browsers
- [ ] Test on mobile devices
- [ ] Check performance
- [ ] Test reverse playback

---

## 🎯 Key Principles

1. **Synchronization**: SEGMENTS and VIDEO_SEGMENTS must be synchronized
2. **Performance**: Use preload and optimized videos
3. **Error handling**: Always add try-catch blocks
4. **Responsiveness**: Support mobile devices
5. **Accessibility**: Add aria-labels and roles
6. **Testing**: Test on different devices and browsers

---

## 🔧 Setup for new project

1. **Copy data structure** (SEGMENTS, VIDEO_SEGMENTS)
2. **Adapt time stamps** to your video
3. **Configure HTML structure** to your design
4. **Create reverse videos** using FFmpeg
5. **Test synchronization** on different devices

This system provides smooth scroll synchronization with video and can be adapted for any projects with similar functionality.
