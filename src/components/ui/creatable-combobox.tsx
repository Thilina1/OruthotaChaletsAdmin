"use client"

import * as React from "react"
import { Check, ChevronDown, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface CreatableComboboxProps {
  options: string[]
  value?: string
  onValueChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  className?: string
}

export function CreatableCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Select or type...",
  emptyText = "No options found.",
  className,
}: CreatableComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value || "")
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // Sync internal input value if external value changes (e.g. form reset or parent set)
  React.useEffect(() => {
    setInputValue(value || "")
  }, [value])

  const filteredOptions = React.useMemo(() => {
    if (!inputValue) return options
    return options.filter((option) =>
      option.toLowerCase().includes(inputValue.toLowerCase())
    )
  }, [options, inputValue])

  const isExactMatch = React.useMemo(() => {
    return options.some(
      (option) => option.toLowerCase() === inputValue.toLowerCase()
    )
  }, [options, inputValue])

  const handleSelect = (val: string) => {
    setInputValue(val)
    onValueChange(val)
    setOpen(false)
  }

  // Handle outside clicks to close the dropdown
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // If click is outside component
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false)
        
        // If the user typed something but didn't explicitly hit Enter or click "Add",
        // we should automatically commit their typed text rather than silently wiping it!
        const trimmed = inputValue.trim();
        if (trimmed && trimmed !== value) {
            handleSelect(trimmed);
        } else {
            // Reset to clean state if they just typed spaces or backed out
            setInputValue(value || "");
        }
      }
    }
    
    // Add event listener when dropdown is open
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open, value])

  return (
    <div ref={wrapperRef} className={cn("relative w-full", className)}>
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && inputValue) {
              e.preventDefault()
              const match = options.find(o => o.toLowerCase() === inputValue.toLowerCase())
              if (match) {
                handleSelect(match)
              } else if (!isExactMatch) {
                handleSelect(inputValue)
              }
            } else if (e.key === "Escape") {
              setOpen(false)
            }
          }}
          onBlur={(e) => {
            // Delay closing to allow onClick/onMouseDown events inside the dropdown to fire first.
            // If focus moves completely outside our wrapper, we commit the text.
            setTimeout(() => {
              if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) {
                setOpen(false)
                const trimmed = inputValue.trim();
                if (trimmed && trimmed !== value) {
                    handleSelect(trimmed);
                } else {
                    setInputValue(value || "");
                }
              }
            }, 100);
          }}
          className="w-full pr-10 bg-background"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-0 top-0 h-full w-9 px-0 opacity-50 hover:bg-transparent"
          onClick={() => setOpen(!open)}
          tabIndex={-1}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {open && (
        <div className="absolute top-full left-0 z-[100] mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in fade-in-0 zoom-in-95">
          <div className="max-h-60 overflow-y-auto p-1">
            {!isExactMatch && inputValue.trim().length > 0 && (
              <button
                type="button"
                className="w-full flex items-center justify-start text-primary hover:bg-accent hover:text-primary font-medium gap-2 px-2 py-2 rounded-sm text-sm"
                onMouseDown={(e) => {
                    e.preventDefault();
                }}
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleSelect(inputValue.trim())
                }}
              >
                <Plus className="h-4 w-4" />
                Add "{inputValue.trim()}"
              </button>
            )}

            {filteredOptions.length === 0 && (!inputValue || isExactMatch) && (
              <div className="py-6 text-center text-sm text-muted-foreground italic">
                {emptyText}
              </div>
            )}

            {filteredOptions.map((option) => (
              <button
                type="button"
                key={option}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-sm py-2 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground text-left",
                  value === option && "bg-accent/50 text-accent-foreground font-medium"
                )}
                onMouseDown={(e) => {
                    e.preventDefault();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(option)
                }}
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  {value === option && <Check className="h-4 w-4 opacity-100" />}
                </span>
                {option}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
