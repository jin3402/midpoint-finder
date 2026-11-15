/** 공유 결과(클립보드 복사, 실패 등)를 잠깐 보여주는 토스트예요. */
export default function ShareToast({ message }: { message: string }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 112,
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100% - 40px)',
        padding: '10px 16px',
        borderRadius: 999,
        background: 'rgba(8, 6, 13, 0.88)',
        color: '#fff',
        fontSize: 13,
        fontWeight: 600,
        textAlign: 'center',
        zIndex: 60,
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      {message}
    </div>
  )
}
