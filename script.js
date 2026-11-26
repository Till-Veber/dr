const app = document.querySelector('#app');
const contentLayer = document.querySelector('.content-layer');
const flowerLayer = document.querySelector('#flower-layer');

const panels = {
  intro: document.querySelector('#panel-intro'),
  day: document.querySelector('#panel-day'),
  night: document.querySelector('#panel-night'),
  final: document.querySelector('#panel-final'),
};

let currentStage = 'intro';
let isTransitioning = false;
let activeCooldown = null;

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

function makeFlower(index) {
  const flower = document.createElement('span');
  const duration = 16 + Math.random() * 19;
  const petals = [0, 60, 120, 180, 240, 300]
    .map((angle) => `<ellipse cx="50" cy="23" rx="10" ry="16" transform="rotate(${angle} 50 50)" />`)
    .join('');

  flower.className = 'flower';
  flower.setAttribute('aria-hidden', 'true');
  flower.style.setProperty('--flower-x', `${Math.random() * 100}%`);
  flower.style.setProperty('--flower-size', `${25 + Math.random() * 54}px`);
  flower.style.setProperty('--flower-duration', `${duration.toFixed(2)}s`);
  flower.style.setProperty('--flower-delay', `${-(Math.random() * duration).toFixed(2)}s`);
  flower.style.setProperty('--flower-rotation', `${Math.round(Math.random() * 360)}deg`);
  flower.style.setProperty('--flower-spin', `${Math.round((Math.random() * 2 - 1) * 240)}deg`);
  flower.style.setProperty('--flower-drift', `${Math.round((Math.random() * 2 - 1) * 18)}vw`);
  flower.style.setProperty('--flower-opacity', `${(.16 + Math.random() * .19).toFixed(2)}`);
  flower.dataset.flower = String(index);
  flower.innerHTML = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" focusable="false">
      <g>${petals}<circle cx="50" cy="50" r="9" /></g>
    </svg>
  `;
  return flower;
}

function createFlowers() {
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 19; index += 1) {
    fragment.append(makeFlower(index));
  }
  flowerLayer.append(fragment);
}

function showPanel(stage) {
  Object.entries(panels).forEach(([name, panel]) => {
    const isActive = name === stage;
    panel.classList.remove('is-exiting');
    panel.classList.toggle('is-visible', isActive);
    panel.setAttribute('aria-hidden', String(!isActive));
    panel.inert = !isActive;
  });
}

async function transitionTo(nextStage) {
  if (isTransitioning || !panels[nextStage]) return;

  isTransitioning = true;
  const previousPanel = panels[currentStage];
  previousPanel.classList.remove('is-visible');
  previousPanel.classList.add('is-exiting');
  previousPanel.setAttribute('aria-hidden', 'true');
  previousPanel.inert = true;

  // Сначала старый экран растворяется, затем начинается смена сцены.
  await wait(560);
  currentStage = nextStage;
  app.dataset.stage = nextStage;
  contentLayer.scrollTo({ top: 0, behavior: 'instant' });

  Object.values(panels).forEach((panel) => {
    panel.classList.remove('is-visible', 'is-exiting');
    panel.setAttribute('aria-hidden', 'true');
    panel.inert = true;
  });

  // Небольшая пауза позволяет новому фону проявиться до появления текста.
  await wait(300);
  showPanel(nextStage);
  await wait(760);
  isTransitioning = false;
}

function restartShake(frame) {
  frame.classList.remove('is-shaking');
  // Перечитывание layout перезапускает CSS-анимацию при повторной ошибке.
  void frame.offsetWidth;
  frame.classList.add('is-shaking');
  window.setTimeout(() => frame.classList.remove('is-shaking'), 470);
}

function cancelActiveCooldown() {
  if (!activeCooldown) return;
  window.clearInterval(activeCooldown.intervalId);
  window.clearTimeout(activeCooldown.timeoutId);
  activeCooldown = null;
}

function startCooldown({ frame, inputs, feedback, submitButton }) {
  cancelActiveCooldown();
  restartShake(frame);

  frame.classList.remove('is-cooldown');
  void frame.offsetWidth;
  frame.classList.add('is-cooldown');

  inputs.forEach((input) => {
    input.disabled = true;
  });
  if (submitButton) submitButton.disabled = true;

  const endTime = Date.now() + 5000;
  const updateMessage = () => {
    const secondsLeft = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    feedback.textContent = secondsLeft > 0
      ? `Пароль неверный. Повторите попытку через ${secondsLeft} с.`
      : '';

    if (secondsLeft === 0) {
      cancelActiveCooldown();
      frame.classList.remove('is-cooldown');
      inputs.forEach((input) => {
        input.disabled = false;
      });
      if (submitButton) submitButton.disabled = false;
      if (inputs[0]) {
        inputs[0].focus({ preventScroll: true });
      }
    }
  };

  updateMessage();
  const intervalId = window.setInterval(updateMessage, 180);
  const timeoutId = window.setTimeout(updateMessage, 5050);
  activeCooldown = { intervalId, timeoutId };
}

function cleanDigits(value) {
  return value.replace(/\D/g, '');
}

function cleanLetters(value) {
  return value.toLocaleUpperCase('ru-RU').replace(/[^A-ZА-ЯЁ]/g, '');
}

function bindSegmentedPassword({
  formId,
  frameId,
  feedbackId,
  expected,
  length,
  sanitize,
  nextStage,
}) {
  const form = document.getElementById(formId);
  const frame = document.getElementById(frameId);
  const feedback = document.getElementById(feedbackId);
  const inputs = [...frame.querySelectorAll('.segmented-input input')];
  let completed = false;

  const readValue = () => inputs.map((input) => input.value).join('');

  const clearValue = () => inputs.forEach((input) => {
    input.value = '';
  });

  const validate = () => {
    if (completed || isTransitioning || inputs.some((input) => input.disabled)) return;
    const value = readValue();
    if (value.length !== length) return;

    if (value === expected) {
      completed = true;
      transitionTo(nextStage);
      return;
    }

    clearValue();
    startCooldown({ frame, inputs, feedback });
  };

  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      const cleaned = sanitize(input.value);
      input.value = cleaned.slice(-1);
      if (input.value && index < inputs.length - 1) {
        inputs[index + 1].focus({ preventScroll: true });
      }
      validate();
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value && index > 0) {
        inputs[index - 1].focus({ preventScroll: true });
      }
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        inputs[index - 1].focus({ preventScroll: true });
      }
      if (event.key === 'ArrowRight' && index < inputs.length - 1) {
        event.preventDefault();
        inputs[index + 1].focus({ preventScroll: true });
      }
    });

    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const pasted = sanitize(event.clipboardData?.getData('text') ?? '').slice(0, length);
      if (!pasted) return;

      clearValue();
      [...pasted].forEach((character, characterIndex) => {
        if (inputs[characterIndex]) inputs[characterIndex].value = character;
      });
      const focusIndex = Math.min(pasted.length, inputs.length - 1);
      inputs[focusIndex].focus({ preventScroll: true });
      validate();
    });
  });

  form.addEventListener('submit', (event) => event.preventDefault());
}

function normalizeCharacterName(value) {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('ru-RU')
    .replace(/ё/g, 'е')
    .replace(/[–—-]/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

function bindCharacterPassword() {
  const form = document.getElementById('form-night');
  const frame = document.getElementById('frame-night');
  const input = document.getElementById('night-code');
  const feedback = document.getElementById('feedback-night');
  const submitButton = form.querySelector('button[type="submit"]');
  const acceptedNames = new Set([
    'крош',
    'ежик',
    'карыч',
    'каркарыч',
    'пин',
    'копатыч',
    'лосяш',
    'совунья',
    'биби',
    'бараш',
    'нюша',
    'панди',
  ]);

  const checkAnswer = () => {
    if (isTransitioning || input.disabled) return;
    const answer = normalizeCharacterName(input.value);
    if (!answer) {
      feedback.textContent = 'Введите имя персонажа.';
      return;
    }

    if (acceptedNames.has(answer)) {
      transitionTo('final');
      return;
    }

    input.value = '';
    startCooldown({
      frame,
      inputs: [input],
      feedback,
      submitButton,
    });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    checkAnswer();
  });

  input.addEventListener('input', () => {
    // Убираем переводы строк и пробелы по краям, но сохраняем возможность ввести «Кар Карыч».
    input.value = input.value.replace(/[\r\n]/g, '').slice(0, 24);
    feedback.textContent = '';
  });
}

function initialize() {
  createFlowers();

  bindSegmentedPassword({
    formId: 'form-intro',
    frameId: 'frame-intro',
    feedbackId: 'feedback-intro',
    expected: '87916',
    length: 5,
    sanitize: cleanDigits,
    nextStage: 'day',
  });

  bindSegmentedPassword({
    formId: 'form-day',
    frameId: 'frame-day',
    feedbackId: 'feedback-day',
    expected: 'NOON',
    length: 4,
    sanitize: cleanLetters,
    nextStage: 'night',
  });

  bindCharacterPassword();

  // По условию приветствие и первое поле появляются через три секунды.
  window.setTimeout(() => showPanel('intro'), 3000);
}

initialize();
