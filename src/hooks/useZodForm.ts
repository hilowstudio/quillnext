import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import * as z from "zod";

// The generic bound MUST be `z.core.$ZodType<any, any>` (Zod 4): the two `any`s are the upper-bound
// input/output positions, which infer per call site — narrowing them to unknown breaks resolution.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented Zod-4 generic constraint
export const useZodForm = <T extends z.core.$ZodType<any, any>>(
    schema: T,
    options?: Omit<
        UseFormProps<
            z.input<T> & import("react-hook-form").FieldValues,
            unknown,
            z.output<T> & import("react-hook-form").FieldValues
        >,
        "resolver"
    >
) => {
    return useForm<
        z.input<T> & import("react-hook-form").FieldValues,
        unknown,
        z.output<T> & import("react-hook-form").FieldValues
    >({
        resolver: zodResolver(schema),
        ...options,
    });
};
