export default function SkeletonLoader() {
  return (
    <div class="min-h-screen bg-black text-white flex items-center justify-center">
      <div class="w-full max-w-[390px] h-screen bg-black overflow-hidden relative mx-auto">
        
        {/* Status Bar Skeleton */}
        <div class="absolute top-0 left-0 right-0 h-[44px] flex items-center justify-between px-6 z-40">
          <div class="w-14 h-5 bg-gray-800/50 rounded-full animate-pulse"></div>
          <div class="flex gap-1.5">
            <div class="w-12 h-5 bg-gray-800/50 rounded-full animate-pulse"></div>
            <div class="w-12 h-5 bg-gray-800/50 rounded-full animate-pulse"></div>
            <div class="w-12 h-5 bg-gray-800/50 rounded-full animate-pulse"></div>
          </div>
        </div>

        {/* Main Content */}
        <div class="h-full pt-[44px] pb-[34px] flex flex-col">
          
          {/* Header Skeleton */}
          <div class="px-5 py-3">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 bg-gray-800/50 rounded-full animate-pulse flex-shrink-0"></div>
              <div class="w-16 h-16 bg-gray-800/50 rounded-full animate-pulse flex-shrink-0"></div>
              <div class="flex-1 min-w-0">
                <div class="h-4 bg-gray-800/50 rounded-lg w-28 mb-2 animate-pulse"></div>
                <div class="h-3 bg-gray-800/50 rounded-lg w-20 animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Bid Card Skeleton */}
          <div class="px-5 py-2">
            <div class="bg-gray-900/50 rounded-2xl p-4 mb-3 border border-gray-800/50">
              <div class="flex items-center justify-between">
                <div class="flex-1">
                  <div class="h-2.5 bg-gray-800/50 rounded-lg w-16 mb-2 animate-pulse"></div>
                  <div class="h-9 bg-gray-800/50 rounded-lg w-32 mb-1 animate-pulse"></div>
                  <div class="h-2 bg-gray-800/50 rounded-lg w-12 animate-pulse"></div>
                </div>
                <div class="w-20 h-20 bg-gray-800/50 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div class="px-5 mb-3">
            <div class="flex gap-2 bg-gray-900/50 rounded-2xl p-1.5 border border-gray-800/50">
              {[...Array(4)].map((_, i) => (
                <div key={i} class="flex-1 h-9 bg-gray-800/50 rounded-xl animate-pulse"></div>
              ))}
            </div>
          </div>

          {/* Content Skeleton */}
          <div class="flex-1 px-5 space-y-2 overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} class="bg-gray-900/50 rounded-xl p-3 border border-gray-800/50 animate-pulse">
                <div class="flex items-center gap-2.5">
                  <div class="w-10 h-10 bg-gray-800/50 rounded-full"></div>
                  <div class="flex-1">
                    <div class="h-3 bg-gray-800/50 rounded-lg w-24 mb-2"></div>
                    <div class="h-2.5 bg-gray-800/50 rounded-lg w-16"></div>
                  </div>
                  <div class="h-4 bg-gray-800/50 rounded-lg w-14"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Safe Area */}
          <div class="h-[34px] bg-black"></div>
          
          {/* Bid Button Skeleton */}
          <div class="absolute bottom-[10px] left-1/2 transform -translate-x-1/2 w-[calc(100%-40px)] z-50">
            <div class="h-14 bg-gray-800/50 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
