/** Tiny DOM helpers shared by the view modules. Text always goes in through `textContent`. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className !== undefined) element.className = className;
  element.append(...children);
  return element;
}

export function button(className: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', className);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}
