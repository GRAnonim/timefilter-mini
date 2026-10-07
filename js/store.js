/* Ответы хранятся в облаке Telegram у этого пользователя. В браузере — в localStorage. */
(function () {
  const KEY = "timefilter";

  function empty() {
    return { goals: [], events: [] };
  }

  function cloud() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!tg || !tg.CloudStorage || !tg.initData) return null;
    return tg.CloudStorage;
  }

  function readLocal() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return empty();
      const data = JSON.parse(raw);
      data.goals = data.goals || [];
      data.events = data.events || [];
      return data;
    } catch (error) {
      return empty();
    }
  }

  function writeLocal(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function load() {
    const storage = cloud();
    if (!storage) return Promise.resolve(readLocal());
    return new Promise(function (resolve) {
      storage.getItem(KEY, function (error, value) {
        if (error || !value) {
          resolve(readLocal());
          return;
        }
        try {
          const data = JSON.parse(value);
          data.goals = data.goals || [];
          data.events = data.events || [];
          resolve(data);
        } catch (parseError) {
          resolve(empty());
        }
      });
    });
  }

  function save(data) {
    writeLocal(data);
    const storage = cloud();
    if (!storage) return Promise.resolve();
    let payload = JSON.stringify(data);
    if (payload.length > 4000 && data.events.length > 8) {
      const trimmed = {
        goals: data.goals,
        goalMonths: data.goalMonths,
        events: data.events.slice(-8),
      };
      payload = JSON.stringify(trimmed);
    }
    return new Promise(function (resolve) {
      storage.setItem(KEY, payload, function () { resolve(); });
    });
  }

  window.TimeStore = { load: load, save: save };
})();
