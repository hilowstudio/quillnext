import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type UseFormProps } from "react-hook-form";
import * as z from "zod";

export const useZodForm = <T extends z.ZodTypeAny>(
    schema: T,
    options?: Omit<UseFormProps<z.input<T> & import("react-hook-form").FieldValues>, "resolver">
) => {
    return useForm<
        z.input<T> & import("react-hook-form").FieldValues,
        unknown,
        z.output<T> & import("react-hook-form").FieldValues
    >({
        // zodResolver's overloads don't accept a passthrough generic schema (`T extends z.ZodTypeAny`) — it needs a
        // concrete schema to infer input/output, so the call can't type-check here even though the resolver is correct
        // at runtime for any zod schema. The useForm<...> generics above keep every consumer's form types honest; this
        // suppresses ONLY the generic-inference gap, and self-cleans if zodResolver's typings ever accept generics.
        // @ts-expect-error — zodResolver cannot infer types through a passthrough generic schema (see note above)
        resolver: zodResolver(schema),
        ...options,
    });
};
