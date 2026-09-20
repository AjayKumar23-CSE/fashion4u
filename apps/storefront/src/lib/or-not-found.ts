import { notFound } from "next/navigation";
import { ApiError } from "./api";

// An API 404 becomes the storefront's 404 page; anything else is a real error.
export async function orNotFound<T>(request: Promise<T>): Promise<T> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}
