import { useState, useCallback, useEffect } from 'react';

/**
 * A custom hook to manage numeric inputs professionally.
 * It allows the input to be temporarily empty during user editing,
 * preventing the annoying "0" prefix when typing a new number.
 * It sanitizes the value on blur to ensure data integrity.
 *
 * @param initialValue The initial numeric value.
 * @param onUpdate The callback function to update the parent component's state. It receives a number.
 * @param defaultValue The value to fall back to on blur if the input is empty or invalid. Defaults to 0.
 * @returns An object with `value`, `onChange`, and `onBlur` props to be spread onto an <input> element.
 */
export const useNumericInput = (
    initialValue: number | undefined,
    onUpdate: (value: number) => void,
    defaultValue: number = 0
) => {
    const [inputValue, setInputValue] = useState(String(initialValue ?? defaultValue));

    // Effect to sync local state if the initial value prop changes from outside
    useEffect(() => {
        setInputValue(String(initialValue ?? defaultValue));
    }, [initialValue, defaultValue]);

    const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setInputValue(val);

        // Allow real-time updates if the value is a valid number or a partial number (like '-')
        if (val === '' || val === '-') {
            // Don't update parent yet, allow temporary empty/negative state
        } else {
            const parsed = parseFloat(val);
            if (!isNaN(parsed)) {
                onUpdate(parsed);
            }
        }
    }, [onUpdate]);

    const handleBlur = useCallback(() => {
        const parsed = parseFloat(inputValue);
        if (isNaN(parsed)) {
            onUpdate(defaultValue);
            setInputValue(String(defaultValue));
        } else {
            // Ensure the state is updated with the final sanitized number
            onUpdate(parsed);
            // And the display value is a clean representation of that number
            setInputValue(String(parsed));
        }
    }, [inputValue, onUpdate, defaultValue]);

    return {
        value: inputValue,
        onChange: handleChange,
        onBlur: handleBlur,
    };
};
