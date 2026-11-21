export type Handler<E> = (event: E) => void;

/** By default a failing subscriber is reported asynchronously, so it can never stall the game loop. */
const rethrowLater = (error: unknown): void => {
  queueMicrotask(() => {
    throw error;
  });
};

/** Minimal synchronous pub/sub. Subscribers are called in subscription order. */
export class EventBus<E> {
  private handlers: readonly Handler<E>[] = [];
  private readonly onHandlerError: (error: unknown) => void;

  constructor(onHandlerError: (error: unknown) => void = rethrowLater) {
    this.onHandlerError = onHandlerError;
  }

  /** Returns the unsubscribe function. Safe to call while an event is being published. */
  subscribe(handler: Handler<E>): () => void {
    this.handlers = [...this.handlers, handler];
    return () => {
      this.handlers = this.handlers.filter((candidate) => candidate !== handler);
    };
  }

  publish(event: E): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        this.onHandlerError(error);
      }
    }
  }
}
