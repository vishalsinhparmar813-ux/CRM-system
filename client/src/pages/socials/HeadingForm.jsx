import { useEffect , useState} from "react";
import TextInput from "@/components/ui/TextInput";

const HeadingForm = ({ fields, register, errors, append, remove, setValue }) => {
//   useEffect(() => {
//     if (fields.length === 0) {
//       append();
//       setValue(`typedata[${fields.length }].type`, typeOptions[0].value);
//     }
//   }, []);

  return (
      <div className="col-span-2 flex md:flex-row flex-col gap-3 pb-5">
        <div className="min-w-[95%]">
          <TextInput
            id="heading"
            classLabel="text-white text-md font-normal mb-[2px]"
            label="Heading"
            name="name"
            type="text"
            placeholder="Enter Heading"
            register={register}
               required="required"
            error={errors?.heading}
            className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
          />
        </div>
      </div>
      
  );
};

export default HeadingForm;
