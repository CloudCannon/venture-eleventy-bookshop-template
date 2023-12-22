import { disableBodyScroll, enableBodyScroll } from "body-scroll-lock";
import "./form-validation";
import "./gallery";
import "./leaflet";
import "./map"

const nav = document.getElementById("main-menu");
const openClass = "c-navigation--open";
const closeClass = "c-navigation--close";

var focusableEls = nav.querySelectorAll('a[href]:not([disabled]), button:not([disabled])');
var firstFocusableEl = focusableEls[1];  // 1 as 0 is the skip to content button
var lastFocusableEl = focusableEls[focusableEls.length - 1];
var KEYCODE_TAB = 9;

const swapOpenState = () => {
  if (!nav) return;
  if (nav.classList.contains(openClass)) {
    nav.classList.remove(openClass);
    nav.classList.add(closeClass);
    nav.removeEventListener('keydown', trapFocus)
    enableBodyScroll(nav);
  } else {
    nav.classList.add(openClass);
    nav.classList.remove(closeClass);
    nav.addEventListener('keydown', trapFocus)
    disableBodyScroll(nav);
  }
};

function trapFocus(e) {
  console.log(e)
    var isTabPressed = (e.key === 'Tab' || e.keyCode === KEYCODE_TAB);

    if (!isTabPressed) { 
      return; 
    }

    if ( e.shiftKey ) /* shift + tab */ {
      if (document.activeElement === firstFocusableEl) {
        lastFocusableEl.focus();
          e.preventDefault();
        }
    } else /* tab */ {
      if (document.activeElement === lastFocusableEl) {
        firstFocusableEl.focus();
          e.preventDefault();
        }
      }
}

const mainMenuToggle = document.getElementById("main-menu-toggle");
mainMenuToggle.addEventListener("click", swapOpenState);

let resizeTimeout;

const debounce = (func, delay) => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(func, delay);
};

// Check if on desktop view
const checkViewportSize = () => {
  if (window.innerWidth >= 769) {
    enableBodyScroll(document.getElementById("main-menu"));
    nav.classList.remove(closeClass);
    nav.classList.remove(openClass);
  }
};

window.addEventListener("resize", () => debounce(checkViewportSize, 600));
checkViewportSize(); // Trigger on initial page load



// check header height
function checkHeaderHeight() {
  // select header element
  const header = document.querySelector('.c-navigation');
  // get rendered styles
  const styles = window.getComputedStyle(header);
  // set header height rendered style
  const headerHeight = styles.height;
  // set CSS as a value
  document.documentElement.style.setProperty("--nav-height", headerHeight);
}
addEventListener("resize", checkHeaderHeight);
addEventListener("orientationchange", checkHeaderHeight);
checkHeaderHeight();
