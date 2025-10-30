import { Schema, model, InferSchemaType } from 'mongoose';

const DepartmentSchema = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: false },
    description: { type: String, required: false },
  },
  { timestamps: true },
);

export type Department = InferSchemaType<typeof DepartmentSchema> & { id: string };
export const DepartmentModel = model('Department', DepartmentSchema);

const UserDepartmentSchema = new Schema(
  {
    username: { type: String, required: true, index: true },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
  },
  { timestamps: true },
);

export type UserDepartment = InferSchemaType<typeof UserDepartmentSchema>;
export const UserDepartmentModel = model('UserDepartment', UserDepartmentSchema);


