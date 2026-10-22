// A duration in milliseconds as `m:ss`, or `h:mm:ss` from one hour; seconds rounded down.
export const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const [hours, minutes] = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60];
  const ss = String(seconds % 60).padStart(2, "0");
  return hours === 0 ? `${minutes}:${ss}` : `${hours}:${String(minutes).padStart(2, "0")}:${ss}`;
};
