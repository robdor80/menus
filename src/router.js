const VIEW_HOME = "home";
const VIEW_EDIT = "edit";

const VALID_VIEWS = new Set([VIEW_HOME, VIEW_EDIT]);

export { VIEW_HOME, VIEW_EDIT };

export function getViewFromHash() {
  const rawHash = window.location.hash.replace("#", "").trim().toLowerCase();
  if (VALID_VIEWS.has(rawHash)) {
    return rawHash;
  }
  return VIEW_HOME;
}

export function setViewInHash(view) {
  const safeView = VALID_VIEWS.has(view) ? view : VIEW_HOME;
  const targetHash = `#${safeView}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
}

export function onViewChange(listener) {
  window.addEventListener("hashchange", () => {
    listener(getViewFromHash());
  });
}
