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

const TaskUpdateForm = ({
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
    setValue(`tasks[${fields.length}].type`, typeOptions[0].value);
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
          // key={field.id}
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
              onWheel={(e) => {
                e.currentTarget.blur();
              }}
              onKeyDown={(e) => {
                if (["e", "E", "-", "+", "."].includes(e.key)){
                  e.preventDefault();
                }
              }}
              error={errors.tasks?.[index]?.reward}
              className="bg-[#f5f5f5] text-[#2F3940] border border-[#0000001F] focus:outline-none focus-visible:outline-none placeholder:text-[#939393] rounded-md"
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
              // name="link"
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
              register={register}
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
          
        </div>
      ))}
      
    </>
  );
};

export default TaskUpdateForm;
