import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import * as z from "zod";

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
