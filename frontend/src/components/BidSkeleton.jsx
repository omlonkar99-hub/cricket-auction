export default function BidSkeleton() {
  return (
    <div class="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div class="glass p-4 rounded-xl border border-gray-200 dark:border-gray-700 animate-pulse">
          <div class="flex items-center justify-between">
            <div class="flex-1">
              <div class="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 mb-2"></div>
              <div class="h-3 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
            </div>
            <div class="h-6 bg-gray-300 dark:bg-gray-700 rounded w-28"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
