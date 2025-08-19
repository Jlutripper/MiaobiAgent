import React, { useState, useEffect, useCallback } from 'react';
import { dbService } from '../services/dbService';

export function useIndexedDBStore<T extends { id: string }>(key: string, initialValue: T[]): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const [storedValue, setStoredValue] = useState<T[]>(initialValue);

  // Effect to load data from IndexedDB on initial mount
  useEffect(() => {
    let isMounted = true;
    dbService.getAll<T>(key).then(valueFromDb => {
      if (isMounted) {
        if (valueFromDb && valueFromDb.length > 0) {
          setStoredValue(valueFromDb);
        } else {
          // If nothing is in DB, set it to the initial value
          dbService.bulkPut(key, initialValue);
          setStoredValue(initialValue);
        }
      }
    }).catch(error => {
      console.error(`Error loading from IndexedDB for key "${key}":`, error);
      if (isMounted) {
        setStoredValue(initialValue);
      }
    });

    return () => { isMounted = false; };
  }, [key]); // Only run on mount and if key changes

  const setValue = useCallback<React.Dispatch<React.SetStateAction<T[]>>>((value) => {
    try {
      // Use the functional update form of useState's setter.
      // This guarantees that we have the latest state value, preventing stale state issues.
      setStoredValue(currentVal => {
        const valueToStore = value instanceof Function ? value(currentVal) : value;
        // Persist to IndexedDB by clearing and re-adding all items.
        // This is a simple way to ensure the DB mirrors the state.
        dbService.clear(key).then(() => {
            dbService.bulkPut(key, valueToStore);
        });
        return valueToStore;
      });
    } catch (error) {
      console.error(`Error saving to IndexedDB for key "${key}":`, error);
    }
  }, [key]);

  return [storedValue, setValue];
}
