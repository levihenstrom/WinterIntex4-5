export default function DonationWidget() {
  return (
    <div className="w-full flex justify-center lg:justify-start">
      <iframe
        name="givebutter"
        title="givebutter-iframe"
        {...({ allowpaymentrequest: 'true' } as any)}
        allow="payment"
        className="w-full bg-white border border-stone-200 rounded-2xl shadow-sm transition-all duration-300"
        style={{
          maxWidth: '440px',
          overflow: 'hidden',
          height: '696px',
          borderBottom: '1px solid #f3f4f6',
        }}
        src="https://givebutter.com/embed/c/ozvC2F?goalBar=false&gba_gb.element.id=jN24wj"
        id="iFrameResizer0"
        scrolling="no"
      />
    </div>
  );
}
