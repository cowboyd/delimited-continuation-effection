export function serializable<T>(value: T, toJSON: () => unknown): T {
  return Object.defineProperty(value, "toJSON", {
    enumerable: false,
    value: toJSON,
  });
}

export function serialize(value: Serializable | unknown): unknown {
  if (isSerializable(value)) {
    return value.toJSON();
  } else {
    return String(value);
  }
}

function isSerializable(value: unknown): value is Serializable {
  return !!value && typeof (value as Serializable).toJSON === "function";
}

interface Serializable {
  toJSON(): unknown;
}
