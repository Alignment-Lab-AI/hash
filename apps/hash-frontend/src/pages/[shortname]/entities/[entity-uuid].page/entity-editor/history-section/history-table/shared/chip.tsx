import type { SxProps, Theme } from "@mui/material";
import { Stack } from "@mui/material";
import type { PropsWithChildren } from "react";

export const Chip = ({
  children,
  type,
  showInFull,
  sx,
  value,
}: PropsWithChildren<{
  type?: boolean;
  showInFull?: boolean;
  sx?: SxProps<Theme>;
  value?: boolean;
}>) => (
  <Stack
    direction="row"
    alignItems="center"
    sx={[
      ({ palette }) => ({
        background: palette.common.white,
        border: `1px solid ${palette.gray[30]}`,
        borderRadius: type ? 4 : 2,
        fontWeight: 500,
        fontSize: 12,
        px: value ? 1.2 : 1,
        py: 0.5,
        whiteSpace: "nowrap",
        ...(showInFull
          ? {}
          : {
              overflow: "hidden",
            }),
      }),
      ...(Array.isArray(sx) ? sx : [sx]),
    ]}
  >
    {children}
  </Stack>
);
