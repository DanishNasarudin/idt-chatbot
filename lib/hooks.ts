import { useLocalStorage } from "usehooks-ts";

export const useStartTime = (): [
  number | null,
  (value: number | null) => void
] => {
  const [startTime, setStartTime, _] = useLocalStorage<number | null>(
    "startTime",
    null
  );
  return [startTime, setStartTime];
};
