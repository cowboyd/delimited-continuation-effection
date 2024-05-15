export type Maybe<T> = {
  type: "just";
  value: T;
} | {
  type: "none";
};

export function Just<T>(value: T): Maybe<T> {
  return { type: "just", value };
}

const none = { type: "none" };

export function None<T>(): Maybe<T> {
  return none as Maybe<T>;
}
