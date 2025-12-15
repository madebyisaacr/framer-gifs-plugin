import { QueryErrorResetBoundary, useMutation } from "@tanstack/react-query"
import cx from "classnames"
import { Draggable, framer, useIsAllowedTo } from "framer-plugin"
import {
    memo,
    type PropsWithChildren,
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { ErrorBoundary } from "react-error-boundary"
import {
    getContentDimensions,
    getContentUrl,
    type KlipyContent,
    type KlipyContentType,
    useListContentInfinite,
} from "./api"
import Tabs from "./Tabs"

const mode = framer.mode

const minColumnWidth = mode === "image" ? 120 : 110
const columnGap = 8
const sidePadding = 15 * 2

if (mode === "image") {
    void framer.showUI({
        width: 600,
        height: 550,
    })
} else {
    void framer.showUI({
        position: "top right",
        width: 300,
        minWidth: 260,
        maxWidth: 750,
        minHeight: 400,
        resizable: true,
    })
}

// localStorage utility functions
const SELECTED_TAB_KEY = "framestack-gifs-selected-tab"

const saveSelectedTab = (tab: "gifs" | "stickers") => {
    try {
        localStorage.setItem(SELECTED_TAB_KEY, tab)
    } catch (error) {
        console.warn("Failed to save selected tab to localStorage:", error)
    }
}

const getSelectedTab = (): "gifs" | "stickers" => {
    try {
        const saved = localStorage.getItem(SELECTED_TAB_KEY)
        return saved === "stickers" ? "stickers" : "gifs"
    } catch (error) {
        console.warn("Failed to get selected tab from localStorage:", error)
        return "gifs"
    }
}

export function App() {
    const [query, setQuery] = useState("")
    const [userId, setUserId] = useState<string>("")
    const [type, setType] = useState<"gifs" | "stickers">(getSelectedTab())

    const debouncedQuery = useDebounce(query, 400)

    // Fetch user ID on component mount
    useEffect(() => {
        const fetchUserId = async () => {
            try {
                const user = await framer.getCurrentUser()
                setUserId(user.id)
            } catch (error) {
                console.error("Failed to get current user:", error)
            }
        }

        void fetchUserId()
    }, [])

    const changeType = (type: "gifs" | "stickers") => {
        setType(type)
        saveSelectedTab(type)
    }

    return (
        <main className="flex flex-col gap-0 h-full select-none">
            <div className="pb-[15px] z-10 relative px-[15px] flex gap-[10px] sm:flex-row-reverse flex-col">
                <Tabs
                    className="sm:!w-[180px]"
                    items={[
                        {
                            label: "GIFs",
                            active: type === "gifs",
                            select: () => {
                                changeType("gifs")
                            },
                        },
                        {
                            label: "Stickers",
                            active: type === "stickers",
                            select: () => {
                                changeType("stickers")
                            },
                        },
                    ]}
                />
                <div className="bg-primary z-10 relative flex-1">
                    <input
                        type="text"
                        placeholder="Search…"
                        value={query}
                        className="w-full pl-[30px] pr-[116px]"
                        autoFocus
                        onChange={e => {
                            setQuery(e.target.value)
                        }}
                    />
                    <div className="flex items-center justify-center absolute left-[10px] top-0 bottom-0 text-tertiary pointer-events-none">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="11.384"
                            height="11.134"
                            fill="none"
                            overflow="visible"
                        >
                            <path
                                d="M 5 0 C 7.761 0 10 2.239 10 5 C 10 6.046 9.679 7.017 9.13 7.819 L 11.164 9.854 C 11.457 10.146 11.457 10.621 11.164 10.914 C 10.871 11.207 10.396 11.207 10.104 10.914 L 8.107 8.918 C 7.254 9.595 6.174 10 5 10 C 2.239 10 0 7.761 0 5 C 0 2.239 2.239 0 5 0 Z M 1.5 5 C 1.5 6.933 3.067 8.5 5 8.5 C 6.933 8.5 8.5 6.933 8.5 5 C 8.5 3.067 6.933 1.5 5 1.5 C 3.067 1.5 1.5 3.067 1.5 5 Z"
                                fill="currentColor"
                            ></path>
                        </svg>
                    </div>
                    <img
                        src="/klipy-logo.png"
                        className="absolute right-[8px] top-1/2 -translate-y-1/2 h-[14px] pointer-events-none dark:invert"
                    />
                </div>
            </div>
            <AppErrorBoundary>
                <GifsList query={debouncedQuery} userId={userId} type={type} />
            </AppErrorBoundary>
        </main>
    )
}

type ContentId = number

const GifsList = memo(function GifsList({
    query,
    userId,
    type,
}: {
    query: string
    userId: string
    type: KlipyContentType
}) {
    const isAllowedToUpsertImage = useIsAllowedTo("addImage", "setImage")

    const { data, fetchNextPage, isFetchingNextPage, isLoading, hasNextPage } = useListContentInfinite(
        query,
        userId,
        type
    )
    const scrollRef = useRef<HTMLDivElement>(null)
    const [windowWidth, setWindowWidth] = useState(window.innerWidth)
    const deferredWindowWidth = useDeferredValue(windowWidth)
    const previousWindowHeightRef = useRef(window.innerHeight)

    const handleScroll = useCallback(() => {
        if (isFetchingNextPage || isLoading) return

        const scrollElement = scrollRef.current
        if (!scrollElement) return

        const distanceToEnd = scrollElement.scrollHeight - (scrollElement.clientHeight + scrollElement.scrollTop)

        if (distanceToEnd > 150) return

        void fetchNextPage()
    }, [isFetchingNextPage, isLoading, fetchNextPage])

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth)

            // Handle vertical window resize
            if (window.innerHeight > previousWindowHeightRef.current) {
                handleScroll()
            }

            previousWindowHeightRef.current = window.innerHeight
        }

        handleResize()
        window.addEventListener("resize", handleResize)
        return () => {
            window.removeEventListener("resize", handleResize)
        }
    }, [handleScroll])

    const addContentMutation = useMutation({
        mutationFn: async (content: KlipyContent) => {
            if (!userId) {
                throw new Error("User ID not available")
            }

            const mode = framer.mode
            const contentTypeName = type === "gifs" ? "GIF" : "Sticker"

            const imageData = {
                image: getContentUrl(content, "md", "gif"),
                name: content.title ?? contentTypeName,
                altText: content.title ?? undefined,
            }

            try {
                if (mode === "canvas") {
                    await framer.addImage(imageData)
                    void framer.notify(`Inserted ${contentTypeName}`, { variant: "success" })
                    return
                }

                await framer.setImage(imageData)
                void framer.closePlugin()
            } catch (error) {
                console.error("Failed to add image:", error)
                void framer.notify(`Failed to insert ${contentTypeName}`, { variant: "error" })
            }
        },
    })

    useEffect(() => {
        const scrollElement = scrollRef.current

        if (scrollElement) scrollElement.scrollTop = 0
    }, [query])

    useEffect(() => {
        const scrollElement = scrollRef.current
        if (!scrollElement || isLoading) return

        const isScrollable = scrollElement.scrollHeight > scrollElement.clientHeight

        if (isScrollable || !hasNextPage) return

        void fetchNextPage()
    }, [data, hasNextPage, fetchNextPage, deferredWindowWidth, isLoading])

    const [contentColumns, columnWidth] = useMemo(() => {
        const adjustedWindowWidth = deferredWindowWidth - sidePadding
        const columnCount = Math.max(1, Math.floor((adjustedWindowWidth + columnGap) / (minColumnWidth + columnGap)))
        const columnWidth = (adjustedWindowWidth - (columnCount - 1) * columnGap) / columnCount
        const heightPerColumn = Array<number>(columnCount).fill(0)

        const seenContent = new Set<ContentId>()
        const columns = Array.from({ length: columnCount }, (): KlipyContent[] => [])

        if (!data) return [columns, columnWidth]

        for (const page of data.pages) {
            // TODO: Cache pages?

            for (const content of page.results) {
                // Could have duplicates with pagination
                if (seenContent.has(content.id)) continue
                seenContent.add(content.id)

                const itemHeight = heightForContent(content, columnWidth)

                const minColumnIndex = heightPerColumn.indexOf(Math.min(...heightPerColumn))
                if (minColumnIndex === -1) continue

                columns[minColumnIndex]?.push(content)
                if (heightPerColumn[minColumnIndex] === undefined) throw new Error("Logic error")
                heightPerColumn[minColumnIndex] += itemHeight
            }
        }
        return [columns, columnWidth] as const
    }, [data, deferredWindowWidth])

    const isLoadingVisible = isLoading || isFetchingNextPage

    if (!userId) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="framer-spinner" />
            </div>
        )
    }

    if (!isLoadingVisible && contentColumns[0]?.length === 0) {
        const contentTypeName = type === "gifs" ? "GIFs" : "stickers"
        return <div className="flex-1 flex items-center justify-center text-tertiary">No {contentTypeName} found</div>
    }

    return (
        <div
            className="overflow-auto relative flex-1 rounded-t-[8px] mx-[15px] no-scrollbar"
            ref={scrollRef}
            onScroll={handleScroll}
        >
            <div className="relative">
                <div className="flex gap-[8px]">
                    {contentColumns.map((content, i) => (
                        <div
                            key={`column-${i}`}
                            className="shrink-0 flex flex-col gap-[8px]"
                            style={{ width: columnWidth }}
                        >
                            {content.map(item => (
                                <GridItem
                                    key={item.id}
                                    content={item}
                                    height={heightForContent(item, columnWidth)}
                                    width={columnWidth}
                                    loading={
                                        addContentMutation.isPending && addContentMutation.variables?.id === item.id
                                    }
                                    onSelect={addContentMutation.mutate}
                                    isAllowedToUpsertImage={isAllowedToUpsertImage}
                                    userId={userId}
                                />
                            ))}
                            {isLoadingVisible && <Placeholders index={i} />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
})

interface GridItemProps {
    content: KlipyContent
    height: number
    width: number
    loading: boolean
    onSelect: (content: KlipyContent) => void
    isAllowedToUpsertImage: boolean
    userId: string
}

const GridItem = memo(function GridItem({
    content,
    loading,
    height,
    onSelect,
    isAllowedToUpsertImage,
    userId,
}: GridItemProps) {
    const handleClick = useCallback(() => {
        onSelect(content)
    }, [onSelect, content])
    const [imageLoaded, setImageLoaded] = useState(false)

    const handleImageLoad = useCallback(() => {
        setImageLoaded(true)
    }, [])

    return (
        <Draggable
            data={{
                type: "image",
                image: getContentUrl(content, "md", "gif"),
                previewImage: getContentUrl(content, "sm", "webp"),
                name: content.title ?? "Content",
                altText: content.title ?? undefined,
            }}
        >
            <button
                onClick={() => {
                    if (!isAllowedToUpsertImage || !userId) return
                    handleClick()
                }}
                className="cursor-pointer bg-cover relative rounded-lg overflow-hidden bg-tertiary"
                style={{ height }}
                disabled={!isAllowedToUpsertImage || !userId}
                title={content.title}
            >
                {/* Main image - loads once and triggers onLoad */}
                <img
                    src={getContentUrl(content, "sm", "webp")}
                    onLoad={handleImageLoad}
                    className="absolute inset-0 w-full h-full object-cover rounded-lg"
                    alt={content.title ?? "Content"}
                    loading="lazy"
                />

                {/* Blur preview - fades out after image loads */}
                <div
                    className="absolute inset-0 bg-cover bg-center rounded-lg transition-opacity duration-150"
                    style={{
                        backgroundImage: `url(${content.blur_preview})`,
                        opacity: imageLoaded ? 0 : 1,
                    }}
                />

                {/* Loading overlay */}
                <div
                    className={cx(
                        "absolute inset-0 rounded-lg flex items-center justify-center transition-all pointer-events-none",
                        loading && "bg-black-dimmed"
                    )}
                >
                    {loading && <div className="framer-spinner bg-white" />}
                </div>
            </button>
        </Draggable>
    )
})

const AppErrorBoundary = ({ children }: PropsWithChildren<object>) => (
    <QueryErrorResetBoundary>
        {({ reset }) => (
            <ErrorBoundary
                onReset={reset}
                fallbackRender={({ resetErrorBoundary }) => (
                    <div className="flex flex-1 items-center justify-center flex-col max-w-[200px] m-auto text-tertiary">
                        Could not load content
                        <button
                            className="bg-transparent hover:bg-transparent active:bg-transparent text-blue-600 outline-hidden"
                            onClick={() => {
                                resetErrorBoundary()
                            }}
                        >
                            Try again
                        </button>
                    </div>
                )}
            >
                {children}
            </ErrorBoundary>
        )}
    </QueryErrorResetBoundary>
)

const placeholderHeights = [
    [120, 70, 90, 86],
    [70, 140, 120, 70],
    [140, 60, 70, 90],
    [90, 130, 60, 120],
]

const Placeholders = ({ index }: { index: number }) => {
    const heights = placeholderHeights[index % placeholderHeights.length]
    if (!heights) return null

    return heights.map((height, heightIndex) => (
        <div key={heightIndex} className="animate-pulse bg-secondary rounded-md" style={{ height }} />
    ))
}

function heightForContent(content: KlipyContent, columnWidth: number) {
    const { width, height } = getContentDimensions(content, "md")
    const ratio = width / height
    return columnWidth / ratio
}

function useDebounce<T>(value: T, delay: number) {
    const [debouncedValue, setDebouncedValue] = useState<T>(value)

    useEffect(() => {
        const debounce = setTimeout(() => {
            setDebouncedValue(value)
        }, delay)

        return () => {
            clearTimeout(debounce)
        }
    }, [value, delay])

    return debouncedValue
}
