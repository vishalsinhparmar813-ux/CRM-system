import { useState, useEffect } from "react"
import Textinput from "@/components/ui/Textinput";

function DebouncedInput({
    value: initialValue,
    onChange,
    debounce = 500,
    className,
    ...props
}) {
    const [value, setValue] = useState(initialValue)
  
    useEffect(() => {
      setValue(initialValue)
    }, [initialValue])
  
    useEffect(() => {
      const timeout = setTimeout(() => {
        onChange(value)
      }, debounce)
  
      return () => clearTimeout(timeout)
    }, [value])

    return (
      <Textinput
        className={`py-[2px] px-1 text-[10px] ${className}`}
        value={value} 
        onChange={e => setValue(e.target.value)}
        style={{background:"#212121"}}
        {...props}
      />
    )
}

export default DebouncedInput