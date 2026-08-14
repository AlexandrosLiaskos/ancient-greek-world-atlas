class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  values() {
    return this.element.className.split(/\s+/).filter(Boolean);
  }

  contains(value) {
    return this.values().includes(value);
  }

  add(...values) {
    this.element.className = [...new Set([...this.values(), ...values])].join(' ');
  }

  remove(...values) {
    this.element.className = this.values().filter((value) => !values.includes(value)).join(' ');
  }

  toggle(value, force) {
    const shouldAdd = force === undefined ? !this.contains(value) : Boolean(force);
    if (shouldAdd) this.add(value);
    else this.remove(value);
    return shouldAdd;
  }
}

class FakeNode {
  constructor(ownerDocument) {
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
  }

  get isConnected() {
    return Boolean(this.parentNode);
  }
}

class FakeText extends FakeNode {
  constructor(value, ownerDocument) {
    super(ownerDocument);
    this.nodeType = 3;
    this.data = String(value);
  }

  get textContent() {
    return this.data;
  }

  set textContent(value) {
    this.data = String(value ?? '');
  }
}

function matchesSelector(element, selector) {
  if (!(element instanceof FakeElement)) return false;
  if (selector.startsWith('#')) return element.id === selector.slice(1);
  if (selector.startsWith('.')) return element.classList.contains(selector.slice(1));
  const dataMatch = selector.match(/^\[data-([a-z0-9-]+)(?:=["']?([^"'\]]+)["']?)?\]$/i);
  if (dataMatch) {
    const key = dataMatch[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    return key in element.dataset && (dataMatch[2] === undefined || element.dataset[key] === dataMatch[2]);
  }
  return element.tagName.toLowerCase() === selector.toLowerCase();
}

class FakeElement extends FakeNode {
  constructor(tagName, ownerDocument) {
    super(ownerDocument);
    this.nodeType = 1;
    this.tagName = String(tagName).toUpperCase();
    this.childNodes = [];
    this.attributes = new Map();
    this.dataset = {};
    this.className = '';
    this.classList = new FakeClassList(this);
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, String(value)),
      getPropertyValue: (name) => this.style.values.get(name) ?? '',
    };
    this.listeners = new Map();
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.id = '';
  }

  get children() {
    return this.childNodes.filter((node) => node.nodeType === 1);
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    this.replaceChildren(this.ownerDocument.createTextNode(value ?? ''));
  }

  append(...nodes) {
    for (const candidate of nodes.flat(Infinity)) {
      if (candidate === null || candidate === undefined || candidate === false) continue;
      const node = candidate instanceof FakeNode
        ? candidate
        : this.ownerDocument.createTextNode(String(candidate));
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    const stringValue = String(value);
    this.attributes.set(name, stringValue);
    if (name === 'id') this.id = stringValue;
    if (name === 'class') this.className = stringValue;
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[key] = stringValue;
    }
  }

  getAttribute(name) {
    if (name === 'id') return this.id || null;
    if (name === 'class') return this.className || null;
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'hidden') this.hidden = false;
    if (name === 'disabled') this.disabled = false;
  }

  toggleAttribute(name, force) {
    const present = force === undefined ? !this.attributes.has(name) : Boolean(force);
    if (present) this.setAttribute(name, '');
    else this.removeAttribute(name);
    return present;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatchEvent(event) {
    event.target ??= this;
    event.currentTarget = this;
    for (const listener of this.listeners.get(event.type) ?? []) listener(event);
    return true;
  }

  cloneNode(deep = false) {
    const clone = new FakeElement(this.tagName, this.ownerDocument);
    clone.className = this.className;
    clone.hidden = this.hidden;
    clone.disabled = this.disabled;
    clone.checked = this.checked;
    clone.value = this.value;
    clone.id = this.id;
    clone.dataset = { ...this.dataset };
    clone.attributes = new Map(this.attributes);
    for (const [name, value] of this.style.values) clone.style.setProperty(name, value);
    if (deep) {
      clone.append(...this.childNodes.map((child) => (
        child.nodeType === 3
          ? this.ownerDocument.createTextNode(child.textContent)
          : child.cloneNode(true)
      )));
    }
    return clone;
  }

  querySelectorAll(selector) {
    const matches = [];
    const visit = (node) => {
      for (const child of node.children ?? []) {
        if (matchesSelector(child, selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches;
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
}

export function installDOM() {
  const document = {
    createElement(tagName) {
      return new FakeElement(tagName, document);
    },
    createTextNode(value) {
      return new FakeText(value, document);
    },
  };
  globalThis.document = document;
  return document;
}
