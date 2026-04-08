declare global {
  namespace JSX {
    interface IntrinsicElements {
      'givebutter-iframe': any;
    }
  }
}

import { useEffect, useState } from 'react';

export default function DonationWidget() {
  const [height, setHeight] = useState(400); // Initial placeholder height

  useEffect(() => {
    // Listen for Givebutter's internal iframe-resizer broadcast events
    const handleMessage = (event: MessageEvent) => {
      if (typeof event.data === 'string' && event.data.includes('[iFrameSizer]')) {
        // iframe-resizer strings look like: "[iFrameSizer]iFrameResizer0:412:..."
        const match = event.data.match(/\[iFrameSizer\][^:]+:(\d+)/);
        if (match && match[1]) {
           setHeight(parseInt(match[1]) + 50); // Add 50px buffer
        }
      } else if (event.data && typeof event.data === 'object' && event.data.height) {
        // Fallback for standard JSON height events
        setHeight(event.data.height + 50); // Add 50px buffer
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  return (
    <div className="w-full flex justify-center">
      <iframe
        name="givebutter"
        title="givebutter-iframe"
        {...({ allowpaymentrequest: 'true' } as any)}
        allow="payment"
        className="w-full bg-white rounded-[24px] border-0 transition-all duration-300 ease-out"
        style={{ 
          height: `${height}px`, 
          minHeight: '400px',
          width: '100%', 
          overflow: 'hidden' 
        }}
        src="https://givebutter.com/embed/c/ozvC2F?goalBar=false&gba_gb.element.id=jN24wj"
        id="iFrameResizer0"
      />
    </div>
  );
}


