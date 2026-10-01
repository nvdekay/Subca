import Svg, { Path } from 'react-native-svg';

/** Gmail product icon (2020), giữ nguyên hình và màu của Google. */
export function GmailLogo({ width = 32 }: { width?: number }) {
  return (
    <Svg width={width} height={(width * 399.42) / 512} viewBox="0 49.4 512 399.42">
      <Path
        fill="#4285F4"
        d="M34.91 448.818h81.454V251L0 163.727V413.91c0 19.287 15.622 34.91 34.91 34.91z"
      />
      <Path
        fill="#34A853"
        d="M395.636 448.818h81.455c19.287 0 34.909-15.622 34.909-34.909V163.727L395.636 251z"
      />
      <Path
        fill="#FBBC04"
        d="M395.636 99.727V251L512 163.727v-46.545c0-43.142-49.25-67.782-83.782-41.891z"
      />
      <Path fill="#EA4335" d="M116.364 251V99.727L256 204.455 395.636 99.727V251L256 355.727z" />
      <Path
        fill="#C5221F"
        d="M0 117.182v46.545L116.364 251V99.727L83.782 75.291C49.25 49.4 0 74.04 0 117.18z"
      />
    </Svg>
  );
}
