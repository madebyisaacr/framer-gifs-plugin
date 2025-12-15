import { useInfiniteQuery } from "@tanstack/react-query"
import * as v from "valibot"

const klipyFileVariantSchema = v.object({
    gif: v.object({
        url: v.string(),
        width: v.number(),
        height: v.number(),
        size: v.number(),
    }),
    webp: v.object({
        url: v.string(),
        width: v.number(),
        height: v.number(),
        size: v.number(),
    }),
})

const klipyContentSchema = v.object({
    id: v.number(),
    slug: v.string(),
    title: v.string(),
    blur_preview: v.string(), // Base64 blur preview
    file: v.object({
        hd: klipyFileVariantSchema,
        md: klipyFileVariantSchema,
        sm: klipyFileVariantSchema,
        xs: klipyFileVariantSchema,
    }),
    tags: v.array(v.string()),
    type: v.string(),
})

// Legacy alias for backward compatibility
const klipyGifSchema = klipyContentSchema

const klipyDataSchema = v.object({
    data: v.array(klipyContentSchema),
    current_page: v.number(),
    per_page: v.number(),
    has_next: v.boolean(),
})

const klipyResponseSchema = v.object({
    result: v.boolean(),
    data: klipyDataSchema,
})

export type KlipyContent = v.InferInput<typeof klipyContentSchema>
export type KlipyGif = v.InferInput<typeof klipyGifSchema> // Legacy alias
export type KlipyResponse = v.InferInput<typeof klipyResponseSchema>
export type KlipyFileVariant = v.InferInput<typeof klipyFileVariantSchema>

// Content types supported by Klipy API
export type KlipyContentType = "gifs" | "stickers"

// Helper types for file sizes
export type GifSize = "xs" | "sm" | "md" | "hd"
export type GifFormat = "gif" | "webp"

// Helper function to get the best content URL for a given size and format preference
export function getContentUrl(content: KlipyContent, size: GifSize = "md", format: GifFormat = "gif"): string {
    return content.file[size][format].url
}

// Helper function to get content dimensions for a given size
export function getContentDimensions(content: KlipyContent, size: GifSize = "md"): { width: number; height: number } {
    const variant = content.file[size].gif // Both gif and webp have same dimensions
    return { width: variant.width, height: variant.height }
}

// Legacy aliases for backward compatibility
export const getGifUrl = getContentUrl
export const getGifDimensions = getContentDimensions

const pageItemCount = 20

interface FetchOptions extends Omit<RequestInit, "body"> {
    body?: unknown
}

export async function fetchKlipy<TSchema extends v.GenericSchema>(
    path: string,
    schema: TSchema,
    customerId: string,
    { body, ...options }: FetchOptions = {}
): Promise<v.InferInput<TSchema>> {
    const appKey = import.meta.env.VITE_KLIPY_APP_KEY

    if (!appKey) {
        throw new Error("VITE_KLIPY_APP_KEY environment variable is not set")
    }

    if (!customerId) {
        throw new Error("Customer ID is required for Klipy API calls")
    }

    const url = new URL(`https://api.klipy.com/api/v1/${appKey}${path}`)
    url.searchParams.set("customer_id", customerId)

    const response = await fetch(url.toString(), {
        body: body ? JSON.stringify(body) : undefined,
        headers: {
            "Content-Type": "application/json",
            ...((options.headers as Record<string, string>) || {}),
        },
        ...options,
    })

    if (!response.ok) {
        throw new Error(`Failed to fetch Klipy API: ${response.status} ${response.statusText}`)
    }

    const json = (await response.json()) as unknown

    const result = v.safeParse(schema, json)

    if (result.issues) {
        throw new Error(`Failed to parse Klipy API response: ${JSON.stringify(result.issues)}`)
    }

    return result.output
}

export function useListContentInfinite(query: string, customerId: string, contentType: KlipyContentType = "gifs") {
    return useInfiniteQuery({
        queryKey: [contentType, query, customerId],
        initialPageParam: 1,
        queryFn: async ({ pageParam, signal }) => {
            if (query.length === 0) {
                // Get trending content when no search query
                const response = await fetchKlipy(
                    `/${contentType}/trending?page=${pageParam}&per_page=${pageItemCount}`,
                    klipyResponseSchema,
                    customerId,
                    {
                        signal,
                        method: "GET",
                    }
                )

                return {
                    results: response.data.data,
                    current_page: response.data.current_page,
                    per_page: response.data.per_page,
                    has_next: response.data.has_next,
                }
            }

            // Search for content
            const response = await fetchKlipy(
                `/${contentType}/search?q=${encodeURIComponent(query)}&page=${pageParam}&per_page=${pageItemCount}`,
                klipyResponseSchema,
                customerId,
                { signal, method: "GET" }
            )

            return {
                results: response.data.data,
                current_page: response.data.current_page,
                per_page: response.data.per_page,
                has_next: response.data.has_next,
            }
        },
        getNextPageParam: data => {
            if (!data.has_next) {
                return undefined
            }

            return data.current_page + 1
        },
        enabled: !!customerId, // Only run query if we have a customer ID
    })
}

// Legacy alias for backward compatibility
export const useListGifsInfinite = useListContentInfinite
