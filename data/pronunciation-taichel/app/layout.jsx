import './globals.css';

export const metadata = {
  title: 'SpeakPro 44 Sounds',
  description: 'Website luyện phát âm 44 âm tiếng Anh'
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
