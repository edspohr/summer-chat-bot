// User-visible product name. `Salvador` is only the internal repo name and
// lives in package identifiers (`@salvador/*`), Firestore identifiers, and
// TypeScript symbols — never in strings a training participant can read.
//
// Change the constant here to rename the product. Every user-visible string
// pulls from this single source.
export const PRODUCT_NAME = "Summer ChatBot" as const;
