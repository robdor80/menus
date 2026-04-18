export function createStore(initialState) {
  let state = structuredClone(initialState);
  const subscribers = new Set();

  function getState() {
    return state;
  }

  function setState(updater) {
    const nextState =
      typeof updater === "function" ? updater(state) : { ...state, ...updater };
    state = nextState;
    subscribers.forEach((listener) => listener(state));
  }

  function subscribe(listener) {
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }

  return {
    getState,
    setState,
    subscribe
  };
}
