import Alpine from "alpinejs";
import CTFd from "./index";
import { initCyberBg } from "./cyber_bg";

window.CTFd = CTFd;
window.Alpine = Alpine;

Alpine.start();

document.addEventListener("DOMContentLoaded", () => {
  initCyberBg();

  // Countdown Timer targeting 2026.08.29 10:00:00 KST
  const daysEl = document.getElementById('days');
  if (daysEl) {
    const targetDate = new Date('2026-08-29T10:00:00').getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const gap = targetDate - now;

      if (gap <= 0) {
        const timerContainer = document.getElementById('countdown-timer');
        if (timerContainer) {
          timerContainer.innerHTML = "<div class='time-num' style='font-size:1.6rem; letter-spacing:1px;'>GAISC 본 대회 진행 중</div>";
        }
        return;
      }

      const sec = 1000;
      const min = sec * 60;
      const hour = min * 60;
      const day = hour * 24;

      const d = Math.floor(gap / day);
      const h = Math.floor((gap % day) / hour);
      const m = Math.floor((gap % hour) / min);
      const s = Math.floor((gap % min) / sec);

      const days = document.getElementById('days');
      const hours = document.getElementById('hours');
      const minutes = document.getElementById('minutes');
      const seconds = document.getElementById('seconds');

      if (days) days.textContent = d.toString().padStart(2, '0');
      if (hours) hours.textContent = h.toString().padStart(2, '0');
      if (minutes) minutes.textContent = m.toString().padStart(2, '0');
      if (seconds) seconds.textContent = s.toString().padStart(2, '0');
    };

    setInterval(updateCountdown, 1000);
    updateCountdown(); // Initial trigger
  }
});
