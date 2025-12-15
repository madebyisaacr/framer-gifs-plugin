import cx from "classnames"

interface TabItem {
    label: string
    active: boolean
    select: () => void
}

interface Props {
    items: TabItem[]
    className?: string
}

export default function Tabs({ items, className }: Props) {
    const activeIndex = items.findIndex(item => item.active)

    return (
        <div className={cx("tabs", className)}>
            <div className="tab-bg-container">
                {activeIndex !== -1 && (
                    <div
                        className="tab-bg"
                        style={{
                            width: `${100 / items.length}%`,
                            left: `${(100 / items.length) * activeIndex}%`,
                        }}
                    />
                )}
            </div>

            {items.map((item, index) => (
                <button key={index} className={cx("tab", item.active && "active")} onClick={item.select}>
                    {item.label}
                </button>
            ))}
        </div>
    )
}
