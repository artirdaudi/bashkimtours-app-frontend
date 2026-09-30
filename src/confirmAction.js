export function confirmAction(message, { destructive = true } = {}) {
  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "bt-confirm-dialog";
    const title = document.createElement("h2");
    title.textContent = destructive ? "Konfirmo veprimin" : "Konfirmo pagesën";
    const description = document.createElement("p");
    description.textContent = message;
    const actions = document.createElement("div");
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Anulo";
    cancel.className = "bt-btn-secondary";
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "Vazhdo";
    confirm.className = destructive ? "bt-btn-danger" : "bt-btn-primary";
    actions.append(cancel, confirm);
    dialog.append(title, description, actions);
    document.body.append(dialog);
    let finished = false;
    const finish = (value) => {
      if (finished) return;
      finished = true;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    cancel.addEventListener("click", () => finish(false));
    confirm.addEventListener("click", () => finish(true));
    dialog.addEventListener("cancel", (event) => { event.preventDefault(); finish(false); });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) finish(false);
    });
    dialog.showModal();
    cancel.focus();
  });
}
