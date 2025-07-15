import { useEffect, useState } from "react";
import TextInput from "@/components/ui/TextInput";
import Icon from "@/components/ui/Icon";
import Select from "react-select";

const typeOptions = [
  { label: "redirect", value: "redirect" },
  { label: "share-tweets", value: "share-tweets" },
  { label: "redirect-hook", value: "redirect-hook" },
  
];
const styles = {
  option: (provided) => ({
    ...provided,
    fontSize: "14px",
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999,
  }),
  container: (provided) => ({
    ...provided,
    width: "100%",
  }),
};

const OptionMetadata = ({
  fields,
  register,
  errors,
  append,
  remove,
  setValue,
}) => {
  useEffect(() => {
    if (fields.length === 0) {
      addNewRow();
    }
  }, []);

  const addNewRow = () => {
    append();
    setValue(`tasks[${fields.length}].type`, typeOptions[0].value);
  };

  const removeField = (index) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const handleTypeChange = (val, index) => {
    setValue(`tasks[${index}].type`, val.value);
  };

  return (
    <>
      <div className="col-span-2 flex md:flex-row flex-col gap-3 pb-5">
       
      </div>
      {fields.map((field, index) => (
        <div
          className="col-span-2 flex md:flex-row flex-col gap-3 pb-5"
          key={field.id}
        >
          <div className="min-w-[23%]">
            <TextInput
              key={`${field.id}reward`}
              id={`${field.id}-reward`}
              classLabel="text-white text-md font-normal mb-[2px]"
              label="Reward"
              name={`tasks[${index}].reward`}
              type="number"
              placeholder="Enter Reward"
              register={register}
              required="required"
              error={errors.tasks?.[index]?.reward}
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
              onChange={(e) => {
                const value = parseInt(e.target.value, 10);
                if (value > 0) {
                  setValue(`tasks[${index}].reward`, value);
                } else {
                  setValue(`tasks[${index}].reward`, 0); 
                }
              }}
            />
          </div>
          <div className="min-w-[23%]">
            <TextInput
              key={`${field.id}name`}
              id={`${field.id}-name`}
              classLabel="text-white text-md font-normal mb-[2px]"
              label="Name"
              // name="name"
              name={`tasks[${index}].name`}
              type="text"
              placeholder="Enter Name"
              register={register}
              required="required"
              error={errors.tasks?.[index]?.name}
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
            />
          </div>
          <div className="min-w-[23%]">
            <TextInput
              key={`${field.id}link`}
              id={`${field.id}-link`}
              classLabel="text-white text-md font-normal mb-[2px]"
              label="Link"
            
              name={`tasks[${index}].link`}
              type="text"
              placeholder="Enter link"
              register={register}
              required="required"
              error={errors.tasks?.[index]?.link}
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
            />
            {errors.tasks?.[index]?.link && (
              <p className="text-red-500 text-xs mt-1">
                {errors.tasks[index].link.message}
              </p>
            )}
          </div>
          <div className="min-w-[23%]">
            <label
              className="text-white text-md font-normal mb-[2px]"
              htmlFor={`${field.id}-type`}
            >
              Type
            </label>
            <Select
              name="type"
              className="react-select"
              classNamePrefix="select"
              onChange={(val) => handleTypeChange(val, index)}
              options={typeOptions}
              placeholder="Select type"
              id={`${field.id}-type`}
              styles={styles}
              defaultValue={typeOptions[0]}
            />
            {errors.tasks?.[index]?.type && (
              <span className="text-red-600">
                {errors.tasks[index].type.message}
              </span>
            )}
          </div>
          <div
            className="w-[30px] h-[30px] mt-5 p-[2px] rounded-md border-0 hover:bg-[#1C1C1C0D] cursor-pointer"
            onClick={() => removeField(index)}
          >
            <Icon icon="iconamoon:close-thin" width={26} />
          </div>
        </div>
      ))}
      <div
        className="col-span-2 bg-gray-700 flex justify-center items-center text-slate-100 text-md rounded-[6px] h-[36px] gap-2 cursor-pointer hover:bg-gray-900 "
        onClick={addNewRow}
      >
        Add another option <Icon icon="gala:add" width={16} />
      </div>
    </>
  );
};

export default OptionMetadata;
