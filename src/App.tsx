import BottomBannerAd from './features/ads/BottomBannerAd'
import MiddlePointFinder from './features/middle-point/MiddlePointFinder'

export default function App() {
  return (
    <>
      <div style={{ paddingBottom: 96 }}>
        <MiddlePointFinder />
      </div>
      <BottomBannerAd />
    </>
  )
}
