import { ButtonGroup, HStack, IconButton, NativeSelect, Pagination, Text } from "@chakra-ui/react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

// Por defecto 10; se puede ampliar a 50 y no mas.
const PAGE_SIZES = [10, 50];

type Props = {
  count: number; // total de filas, no de paginas
  page: number; // empieza en 1
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemsPerPageLabel: string; // → "Terceros por página" (lo lee el lector de pantalla)
};

export function TablePagination({
  count,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemsPerPageLabel,
}: Props) {
  // → "Mostrando 11–20 de 23"
  const desde = (page - 1) * pageSize + 1;
  const hasta = Math.min(page * pageSize, count);

  return (
    <HStack justify="space-between" wrap="wrap" gap="4">
      <HStack gap="2">
        <Text textStyle="sm" color="fg.muted">
          Mostrar
        </Text>
        <NativeSelect.Root size="sm" width="auto">
          <NativeSelect.Field
            aria-label={itemsPerPageLabel}
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        <Text textStyle="sm" color="fg.muted">
          Mostrando {desde}–{hasta} de {count}
        </Text>
      </HStack>

      <Pagination.Root
        count={count}
        pageSize={pageSize}
        page={page}
        onPageChange={(details) => onPageChange(details.page)}
        translations={{
          prevTriggerLabel: "Página anterior",
          nextTriggerLabel: "Página siguiente",
          itemLabel: (details) => `Página ${details.page}`,
        }}
      >
        <ButtonGroup variant="ghost" size="sm">
          <Pagination.PrevTrigger asChild>
            <IconButton>
              <LuChevronLeft />
            </IconButton>
          </Pagination.PrevTrigger>

          <Pagination.Items
            render={(item) => (
              <IconButton variant={{ base: "ghost", _selected: "outline" }}>{item.value}</IconButton>
            )}
          />

          <Pagination.NextTrigger asChild>
            <IconButton>
              <LuChevronRight />
            </IconButton>
          </Pagination.NextTrigger>
        </ButtonGroup>
      </Pagination.Root>
    </HStack>
  );
}
